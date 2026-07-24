import type {
  WhisperMultiRangeTranscriptionResult,
  WhisperTimeRange,
  WhisperTranscriptionProgress,
} from "../desktop/transcription/whisperTranscription";
import { formatSubtitleRangeTime } from "./subtitleGenerationRange";

export type SubtitleGenerationTaskInput = {
  videoPath: string;
  ranges: WhisperTimeRange[];
  durationMs: number;
  language: string;
};

export type SubtitleGenerationTaskSnapshot = {
  status: "idle" | "running" | "canceling" | "completed" | "failed";
  input: SubtitleGenerationTaskInput | null;
  progress: WhisperTranscriptionProgress | null;
  progressMessage: string | null;
  progressPercent: number | null;
  commandLines: string[];
  outputPath: string | null;
  result: WhisperMultiRangeTranscriptionResult | null;
  presentation: {
    tone: "neutral" | "success" | "error";
    message: string | null;
  };
};

type SubtitleGenerationTaskAdapter = {
  run: (
    input: SubtitleGenerationTaskInput,
    onProgress: (progress: WhisperTranscriptionProgress) => void,
  ) => Promise<WhisperMultiRangeTranscriptionResult>;
  cancel: (input: { videoPath: string }) => Promise<void>;
};

const idleSnapshot = (): SubtitleGenerationTaskSnapshot => ({
  status: "idle",
  input: null,
  progress: null,
  progressMessage: null,
  progressPercent: null,
  commandLines: [],
  outputPath: null,
  result: null,
  presentation: { tone: "neutral", message: null },
});

const formatRange = (range: WhisperTimeRange): string =>
  `${formatSubtitleRangeTime(range.startMs)}–${formatSubtitleRangeTime(range.endMs)}`;

const describeResult = (result: WhisperMultiRangeTranscriptionResult) => {
  const failedDetails = result.failedRanges
    .map(({ range, error }) => `${formatRange(range)}：${error}`)
    .join("；");
  if (result.stopped) {
    return [
      "字幕生成已停止",
      result.completedRanges.length > 0
        ? `已完成 ${result.completedRanges.length} 个（${result.completedRanges.map(formatRange).join("、")}）`
        : "已完成 0 个",
      result.failedRanges.length > 0
        ? `失败 ${result.failedRanges.length} 个（${failedDetails}）`
        : null,
      result.interruptedRange
        ? `中断 ${formatRange(result.interruptedRange)}`
        : null,
      result.pendingRanges.length > 0
        ? `未处理 ${result.pendingRanges.length} 个（${result.pendingRanges.map(formatRange).join("、")}）`
        : null,
    ]
      .filter(Boolean)
      .join("；");
  }
  if (result.outputPath && result.failedRanges.length === 0) {
    return `已生成 ${result.outputPath}`;
  }
  if (result.outputPath) {
    return `已生成 ${result.outputPath}；成功 ${result.completedRanges.length} 个片段，失败 ${result.failedRanges.length} 个片段${failedDetails ? `（${failedDetails}）` : ""}`;
  }
  return `没有生成字幕；失败 ${result.failedRanges.length} 个片段${failedDetails ? `（${failedDetails}）` : ""}`;
};

export const createSubtitleGenerationTaskSession = (
  adapter: SubtitleGenerationTaskAdapter,
) => {
  let snapshot = idleSnapshot();
  let runIdentity: object | null = null;
  const listeners = new Set<(value: SubtitleGenerationTaskSnapshot) => void>();

  const publish = (next: SubtitleGenerationTaskSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  };

  const updateProgress = (
    identity: object,
    progress: WhisperTranscriptionProgress,
  ) => {
    if (runIdentity !== identity || !snapshot.input) return;
    publish({
      ...snapshot,
      progress,
      progressMessage: progress.message,
      progressPercent:
        typeof progress.overallPercent === "number"
          ? progress.overallPercent
          : progress.phase === "completed"
            ? 100
            : snapshot.progressPercent,
      commandLines:
        progress.phase === "command" &&
        !snapshot.commandLines.includes(progress.command)
          ? [...snapshot.commandLines, progress.command]
          : snapshot.commandLines,
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: (value: SubtitleGenerationTaskSnapshot) => void) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    async start(input: SubtitleGenerationTaskInput) {
      const identity = {};
      runIdentity = identity;
      publish({
        ...idleSnapshot(),
        status: "running",
        input,
        progressMessage: "准备生成字幕",
        progressPercent: 0,
      });
      try {
        const result = await adapter.run(input, (progress) =>
          updateProgress(identity, progress),
        );
        if (runIdentity !== identity) return result;
        const message = describeResult(result);
        publish({
          ...snapshot,
          status: "completed",
          progressMessage: message,
          progressPercent: result.stopped ? snapshot.progressPercent : 100,
          outputPath: result.outputPath,
          result,
          presentation: {
            tone:
              result.outputPath && !result.stopped && result.failedRanges.length === 0
                ? "success"
                : result.outputPath || result.stopped
                  ? "neutral"
                  : "error",
            message,
          },
        });
        return result;
      } catch (error) {
        if (runIdentity !== identity) throw error;
        const message = error instanceof Error ? error.message : String(error);
        publish({
          ...snapshot,
          status: "failed",
          outputPath: null,
          result: null,
          presentation: {
            tone: message === "字幕生成已停止" ? "neutral" : "error",
            message,
          },
        });
        throw error;
      }
    },
    async cancel() {
      if (!snapshot.input || snapshot.status !== "running") return;
      const identity = runIdentity;
      const previous = snapshot;
      publish({
        ...snapshot,
        status: "canceling",
        progressMessage: "正在停止字幕生成",
        presentation: { tone: "neutral", message: "正在停止字幕生成" },
      });
      try {
        await adapter.cancel({ videoPath: snapshot.input.videoPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          runIdentity === identity &&
          (snapshot as SubtitleGenerationTaskSnapshot).status === "canceling"
        ) {
          publish({
            ...previous,
            presentation: { tone: "error", message },
          });
        }
        throw error;
      }
    },
    clear() {
      if (snapshot.status === "running" || snapshot.status === "canceling") return;
      runIdentity = null;
      publish(idleSnapshot());
    },
  };
};

export type SubtitleGenerationTaskSession = ReturnType<
  typeof createSubtitleGenerationTaskSession
>;
