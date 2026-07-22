import { existsSync } from "node:fs";
import { classifySubtitleMuxDropPaths } from "../../subtitle-mux/subtitleMuxModel";
import { resolveCliExecutable } from "../cliExecutable";

export interface SubtitleMuxRequest {
  videoPath: string;
  subtitlePath: string;
  outputPath: string;
}

export interface SubtitleMuxResult {
  outputPath: string;
}

export type SubtitleMuxProgress = {
  phase: "starting" | "running" | "completed";
  outTimeMs?: number;
  outTimeLabel?: string;
  speed?: string;
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
  "error",
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
  "1:0",
  "-c",
  "copy",
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
  text: string
): SubtitleMuxProgress | null => {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    entries.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 1));
  }

  if (entries.get("progress") === "end") {
    return { phase: "completed", message: "封装完成" };
  }

  const rawOutTime =
    entries.get("out_time_ms") ?? entries.get("out_time_us") ?? null;
  const outTimeMs = rawOutTime ? Number.parseInt(rawOutTime, 10) / 1000 : null;
  if (!outTimeMs || !Number.isFinite(outTimeMs)) return null;

  const outTimeLabel = formatProgressTime(outTimeMs);
  const speed = entries.get("speed") || undefined;
  return {
    phase: "running",
    outTimeMs,
    outTimeLabel,
    speed,
    message: speed
      ? `已处理 ${outTimeLabel}，速度 ${speed}`
      : `已处理 ${outTimeLabel}`,
  };
};

const readFfmpegProgress = async (
  stream: ReadableStream<Uint8Array> | null,
  onProgress?: (progress: SubtitleMuxProgress) => void
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
        const progress = parseFfmpegProgressText(pendingBlock);
        if (progress) onProgress(progress);
        pendingBlock = "";
      }
    }
  }
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

  onProgress?.({ phase: "starting", message: "正在启动 ffmpeg" });

  let process: SpawnProcess;
  try {
    process = spawn(buildSubtitleMuxCommand(input, resolveExecutable("ffmpeg")), {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      throw new Error("未找到 ffmpeg，请先安装并确认它在 PATH 中");
    }
    throw new Error(message);
  }

  const [exitCode, stderrText] = await Promise.all([
    process.exited,
    new Response(process.stderr as ReadableStream<Uint8Array>).text(),
    readFfmpegProgress(process.stdout as ReadableStream<Uint8Array>, onProgress),
  ]);

  if (exitCode !== 0) {
    throw new Error(stderrText.trim() || `ffmpeg exited with code ${exitCode}`);
  }

  onProgress?.({ phase: "completed", message: "封装完成" });

  return { outputPath: input.outputPath };
};
