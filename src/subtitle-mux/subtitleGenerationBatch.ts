import type { SubtitleGenerationTaskInput } from "./subtitleGenerationTaskSession";
import type { WhisperMultiRangeTranscriptionResult } from "../desktop/transcription/whisperTranscription";

export type BatchVideo = {
  path: string;
  status: "pending" | "reading" | "running" | "completed" | "failed" | "stopped";
  percent: number | null;
  message: string | null;
  outputPath: string | null;
};
export type SubtitleGenerationBatchSnapshot = {
  items: BatchVideo[];
  running: boolean;
  canceling: boolean;
};

/** 批量队列独立于界面生命周期；串行调用现有单视频任务，避免模型并发占用内存。 */
export const createSubtitleGenerationBatch = (adapter: {
  probeDuration: (path: string) => Promise<number>;
  run: (input: SubtitleGenerationTaskInput) => Promise<WhisperMultiRangeTranscriptionResult>;
  cancel: () => Promise<void>;
}) => {
  let snapshot: SubtitleGenerationBatchSnapshot = { items: [], running: false, canceling: false };
  let stopRequested = false;
  let transcribing = false;
  const listeners = new Set<(value: SubtitleGenerationBatchSnapshot) => void>();
  const publish = (patch: Partial<SubtitleGenerationBatchSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener(snapshot));
  };
  const update = (path: string, patch: Partial<BatchVideo>) => publish({
    items: snapshot.items.map(item => item.path === path ? { ...item, ...patch } : item),
  });
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: (value: SubtitleGenerationBatchSnapshot) => void) {
      listeners.add(listener);
      listener(snapshot);
      return () => { listeners.delete(listener); };
    },
    add(paths: string[]) {
      if (snapshot.running) return;
      const existing = new Set(snapshot.items.map(item => item.path));
      const items = [...snapshot.items];
      for (const path of paths.map(path => path.trim()).filter(Boolean)) {
        if (existing.has(path)) continue;
        existing.add(path);
        items.push({ path, status: "pending", percent: null, message: null, outputPath: null });
      }
      publish({ items });
    },
    remove(path: string) {
      if (!snapshot.running) publish({ items: snapshot.items.filter(item => item.path !== path) });
    },
    clear() {
      if (!snapshot.running) publish({ items: [] });
    },
    reportProgress(path: string, percent: number | null, message: string | null) {
      if (snapshot.running && snapshot.items.some(item => item.path === path && item.status === "running")) {
        update(path, { percent, message });
      }
    },
    async start() {
      if (snapshot.running) return;
      stopRequested = false;
      publish({ running: true, canceling: false });
      try {
        // 成功项保留，重新开始只处理等待、失败或停止的文件。
        for (const item of snapshot.items.filter(item => item.status !== "completed")) {
          if (stopRequested) break;
          update(item.path, { status: "reading", percent: null, message: "正在读取视频时长", outputPath: null });
          try {
            const durationMs = await adapter.probeDuration(item.path);
            if (stopRequested) {
              update(item.path, { status: "stopped", message: "已停止" });
              break;
            }
            if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("无法读取有效视频时长");
            update(item.path, { status: "running", percent: 0, message: "准备生成字幕" });
            transcribing = true;
            const result = await adapter.run({ videoPath: item.path, durationMs, ranges: [{ startMs: 0, endMs: durationMs }], language: "ja" });
            transcribing = false;
            const completed = Boolean(result.outputPath) && !result.stopped && result.failedRanges.length === 0;
            update(item.path, {
              status: completed ? "completed" : result.stopped ? "stopped" : "failed",
              percent: completed ? 100 : null,
              outputPath: result.outputPath,
              message: completed ? "已生成字幕" : result.stopped ? "已停止" : result.failedRanges.map(range => range.error).join("；") || "没有生成字幕",
            });
            if (result.stopped) stopRequested = true;
          } catch (error) {
            update(item.path, { status: stopRequested ? "stopped" : "failed", message: error instanceof Error ? error.message : String(error) });
          } finally {
            transcribing = false;
          }
        }
      } finally {
        publish({ running: false, canceling: false });
      }
    },
    async cancel() {
      if (!snapshot.running || snapshot.canceling) return;
      stopRequested = true;
      publish({ canceling: true });
      // 探测阶段没有识别子进程，只需阻止启动；识别阶段沿用既有取消通道。
      if (transcribing) {
        try { await adapter.cancel(); }
        catch (error) {
          if (snapshot.running) publish({ canceling: false });
          throw error;
        }
      }
    },
  };
};
