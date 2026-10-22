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
  phase: "starting" | "running" | "completed" | "failed";
  diagnostics?: string;
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
  onProgress?.({ phase: "starting", message: "正在启动 ffmpeg", diagnostics: report("状态: 正在启动") });

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

  const [exitCode, stderrText] = await Promise.all([
    child.exited,
    new Response(child.stderr as ReadableStream<Uint8Array>).text(),
    readFfmpegProgress(child.stdout as ReadableStream<Uint8Array>, onProgress),
  ]);

  // 即使执行失败也回传命令和日志，便于回查部分生成的视频。
  onProgress?.({
    phase: exitCode === 0 ? "completed" : "failed",
    message: exitCode === 0 ? "封装完成" : `封装失败（退出码 ${exitCode}）`,
    diagnostics: report(`退出码: ${exitCode}`, stderrText.trim()),
  });
  if (exitCode !== 0) {
    throw new Error(stderrText.trim() || `ffmpeg exited with code ${exitCode}`);
  }

  onProgress?.({ phase: "completed", message: "封装完成" });

  return { outputPath: input.outputPath };
};
