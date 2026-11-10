import { existsSync } from "node:fs";
import { classifySubtitleMuxDropPaths } from "../../subtitle-mux/subtitleMuxModel";
import { resolveCliExecutable } from "../cliExecutable";

export interface SubtitleMuxRequest {
  videoPath: string;
  subtitlePath: string;
  outputPath: string;
  ffmpegPath?: string;
}

export interface SubtitleMuxResult {
  outputPath: string;
}

export type SubtitleMuxProgress = {
  phase: "starting" | "running" | "finalizing" | "completed" | "failed";
  diagnostics?: string;
  outTimeMs?: number;
  outTimeLabel?: string;
  speed?: string;
  durationMs?: number;
  percent?: number;
  message: string;
};

type SpawnProcess = ReturnType<typeof Bun.spawn>;

export const buildSubtitleMuxCommand = (
  {
    videoPath,
    subtitlePath,
    outputPath,
  }: SubtitleMuxRequest,
  ffmpegPath = "ffmpeg"
): string[] => [
  ffmpegPath,
  "-nostdin",
  "-loglevel",
  "info",
  "-progress",
  "pipe:1",
  "-nostats",
  "-i",
  videoPath,
  "-i",
  subtitlePath,
  "-map",
  "0",
  "-map",
  "-0:disp:attached_pic?",
  "-map",
  "1:0",
  "-c",
  "copy",
  // MP4 使用 mov_text 字幕；视频、音频及其他流仍直接复制。
  ...(/\.mp4$/i.test(outputPath)
    ? ["-c:s", "mov_text", "-movflags", "+faststart"]
    : []),
  outputPath,
];

const formatProgressTime = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

export const parseFfmpegProgressText = (
  text: string,
  totalDurationMs?: number,
): SubtitleMuxProgress | null => {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    entries.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 1));
  }

  const durationMs = totalDurationMs && Number.isFinite(totalDurationMs) && totalDurationMs > 0
    ? totalDurationMs : undefined;
  if (entries.get("progress") === "end") {
    // 进度流结束后仍须等待进程退出，尤其是 MP4 的 faststart 整理阶段。
    return { phase: "finalizing", durationMs, percent: durationMs ? 99 : undefined, message: "正在完成封装，请稍候" };
  }

  const rawOutTime =
    entries.get("out_time_us") ?? entries.get("out_time_ms");
  const parsedOutTime = rawOutTime ? Number(rawOutTime) / 1000 : NaN;
  if (!Number.isFinite(parsedOutTime)) return null;
  const outTimeMs = Math.max(0, parsedOutTime);

  const outTimeLabel = formatProgressTime(outTimeMs);
  const speed = entries.get("speed") || undefined;
  return {
    phase: "running",
    outTimeMs,
    outTimeLabel,
    speed,
    durationMs,
    percent: durationMs ? Math.min(99, Math.floor(outTimeMs / durationMs * 100)) : undefined,
    message: durationMs
      ? `已处理 ${outTimeLabel} / ${formatProgressTime(durationMs)}`
      : `已处理 ${outTimeLabel}，视频总时长未知`,
  };
};

// 从同一次 FFmpeg 的输入日志读取时长，无需额外运行或依赖 ffprobe。
const readFfmpegLog = async (
  stream: ReadableStream<Uint8Array>,
  onDuration: (durationMs: number) => void,
  onFinalizing: () => void,
): Promise<string> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let pending = "";
  let inputIndex: number | undefined;
  while (true) {
    const { done, value } = await reader.read();
    const chunk = decoder.decode(value, { stream: !done });
    text += chunk;
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = done ? "" : lines.pop() ?? "";
    for (const line of lines) {
      if (line.includes("Starting second pass: moving the moov atom")) onFinalizing();
      const input = line.match(/^Input #(\d+),/);
      if (input) inputIndex = Number(input[1]);
      const duration = inputIndex === 0 && line.match(/^\s*Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (duration) {
        const milliseconds = (Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])) * 1000;
        if (Number.isFinite(milliseconds) && milliseconds > 0) onDuration(milliseconds);
      }
    }
    if (done) return text;
  }
};

const readFfmpegProgress = async (
  stream: ReadableStream<Uint8Array> | null,
  onProgress?: (progress: SubtitleMuxProgress) => void,
  getDuration: () => number | undefined = () => undefined,
): Promise<void> => {
  if (!stream || !onProgress) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pendingText = "";
  let pendingBlock = "";
  let isDone = false;

  while (!isDone) {
    const { done, value } = await reader.read();
    isDone = done;
    pendingText += decoder.decode(value, { stream: !done });
    const lines = pendingText.split(/\r?\n/);
    pendingText = done ? "" : lines.pop() ?? "";

    for (const line of lines) {
      if (!line) continue;
      pendingBlock += `${line}\n`;
      if (line.startsWith("progress=")) {
        const progress = parseFfmpegProgressText(pendingBlock, getDuration());
        if (progress) onProgress(progress);
        pendingBlock = "";
      }
    }
  }
};

const summarizeMuxFailure = (log: string, hasPartialOutput: boolean): string => {
  let message = "软合并失败。请展开下方“命令与日志”查看详情。";
  if (/No space left on device|\bENOSPC\b|not enough space on the disk/i.test(log)) {
    message = "输出磁盘空间不足，无法保存合并视频。请腾出足够空间（建议大于原视频大小）后重试。";
  } else if (/Permission denied|Operation not permitted|Read-only file system|\bEACCES\b|\bEPERM\b/i.test(log)) {
    message = "无法读写文件。请检查文件访问权限，以及输出文件夹是否可写后重试。";
  }
  return hasPartialOutput
    ? `${message}上方输出路径留有未完成文件，请先删除或移走后重试。`
    : message;
};

export const mergeVideoWithSubtitle = async (
  input: SubtitleMuxRequest,
  deps: {
    existsSync?: typeof existsSync;
    resolveExecutable?: (executable: string) => string;
    spawn?: (
      command: string[],
      options: Parameters<typeof Bun.spawn>[1]
    ) => SpawnProcess;
    onProgress?: (progress: SubtitleMuxProgress) => void;
  } = {}
): Promise<SubtitleMuxResult> => {
  const checkExists = deps.existsSync ?? existsSync;
  const resolveExecutable = deps.resolveExecutable ?? resolveCliExecutable;
  const spawn =
    deps.spawn ?? ((command, options) => Bun.spawn(command, options));
  const onProgress = deps.onProgress;

  if (!checkExists(input.videoPath)) {
    throw new Error(`视频文件不存在: ${input.videoPath}`);
  }

  if (!checkExists(input.subtitlePath)) {
    throw new Error(`字幕文件不存在: ${input.subtitlePath}`);
  }

  if (checkExists(input.outputPath)) {
    throw new Error(`输出文件已存在: ${input.outputPath}`);
  }

  const classification = classifySubtitleMuxDropPaths([
    input.videoPath,
    input.subtitlePath,
  ]);
  if (classification.error) {
    throw new Error(classification.error);
  }

  // 记录最终传给 spawn 的参数，不在前端根据当前表单重建命令。
  const command = buildSubtitleMuxCommand(
    input,
    resolveExecutable(input.ffmpegPath?.trim() || "ffmpeg"),
  );
  const quote = (value: string) => process.platform === "win32"
    ? `'${value.replace(/'/g, "''")}'`
    : `'${value.replace(/'/g, "'\\''")}'`;
  const commandLine = `${process.platform === "win32" ? "& " : ""}${command.map(quote).join(" ")}`;
  const report = (status: string, log = "") => [
    `平台: ${process.platform}`,
    `命令（${process.platform === "win32" ? "PowerShell" : "POSIX Shell"}）:`,
    commandLine,
    "实际参数（JSON）:",
    JSON.stringify(command, null, 2),
    status,
    "FFmpeg 日志:",
    log || "（无）",
  ].join("\n");
  onProgress?.({ phase: "starting", message: "正在读取视频并准备软合并", diagnostics: report("状态: 正在启动") });

  let child: SpawnProcess;
  try {
    child = spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.({ phase: "failed", message, diagnostics: report("状态: 启动失败", message) });
    if (/ENOENT/i.test(message)) {
      throw new Error("未找到 ffmpeg，请先安装并确认它在 PATH 中");
    }
    throw new Error(message);
  }

  let durationMs: number | undefined;
  let isFinalizing = false;
  const reportProgress = (progress: SubtitleMuxProgress) => {
    // stderr 与 stdout 独立到达，整理阶段开始后忽略延迟收到的复制进度。
    if (isFinalizing && progress.phase === "running") return;
    if (progress.phase === "finalizing") isFinalizing = true;
    onProgress?.(progress);
  };
  const [exitCode, stderrText] = await Promise.all([
    child.exited,
    readFfmpegLog(child.stderr as ReadableStream<Uint8Array>, value => { durationMs = value; }, () => {
      reportProgress({ phase: "finalizing", durationMs, percent: durationMs ? 99 : undefined, message: "正在整理 MP4 文件，请稍候" });
    }),
    readFfmpegProgress(child.stdout as ReadableStream<Uint8Array>, reportProgress, () => durationMs),
  ]);

  const message = exitCode === 0
    ? "封装完成"
    : summarizeMuxFailure(stderrText, checkExists(input.outputPath));
  // 页面只展示可操作的摘要，原始错误、完整日志和退出码保留在诊断区。
  onProgress?.({
    phase: exitCode === 0 ? "completed" : "failed",
    percent: exitCode === 0 ? 100 : undefined,
    message,
    diagnostics: report(`退出码: ${exitCode}`, stderrText.trim()),
  });
  if (exitCode !== 0) {
    throw new Error(message);
  }

  return { outputPath: input.outputPath };
};
