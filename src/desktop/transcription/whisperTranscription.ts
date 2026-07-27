import { existsSync } from "node:fs";
import {
  readFile as defaultReadFile,
  rm as defaultRm,
  writeFile as defaultWriteFile,
} from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { formatSubtitleRangeTime } from "../../subtitle-mux/subtitleGenerationRange";
import { resolveCliExecutable } from "../cliExecutable";
import {
  buildFasterWhisperCommand,
  parseFasterWhisperProgressText,
} from "./fasterWhisperTranscription";

export type WhisperTimeRange = {
  startMs: number;
  endMs: number;
};

export type WhisperTranscriptionProgress = (
  | { phase: "extracting"; message: string }
  | { phase: "command"; command: string; message: string }
  | { phase: "transcribing"; percent?: number; message: string }
  | { phase: "range-failed"; error: string; message: string }
  | { phase: "completed"; message: string }
) & {
  overallPercent?: number;
  rangeIndex?: number;
  rangeTotal?: number;
  range?: WhisperTimeRange;
};

export const getOverallTranscriptionPercent = ({
  completedDurationMs,
  currentDurationMs,
  totalDurationMs,
  currentPercent,
}: {
  completedDurationMs: number;
  currentDurationMs: number;
  totalDurationMs: number;
  currentPercent: number;
}): number => {
  if (totalDurationMs <= 0) return 0;
  const normalizedCurrentPercent = Math.min(100, Math.max(0, currentPercent));
  const processedDurationMs =
    completedDurationMs + currentDurationMs * (normalizedCurrentPercent / 100);
  return Math.min(
    100,
    Math.max(0, Math.round((processedDurationMs / totalDurationMs) * 100)),
  );
};

export interface WhisperTranscriptionRequest {
  videoPath: string;
  outputPath: string;
  modelPath: string;
  language: string;
  startMs?: number;
  endMs?: number;
  fasterWhisperPythonPath?: string;
}

export interface WhisperTranscriptionResult {
  outputPath: string;
}

export interface WhisperMultiRangeTranscriptionRequest
  extends Omit<WhisperTranscriptionRequest, "startMs" | "endMs"> {
  ranges: WhisperTimeRange[];
}

export interface WhisperMultiRangeTranscriptionResult {
  outputPath: string | null;
  completedRanges: WhisperTimeRange[];
  failedRanges: Array<{ range: WhisperTimeRange; error: string }>;
  interruptedRange: WhisperTimeRange | null;
  pendingRanges: WhisperTimeRange[];
  stopped: boolean;
}

type SpawnProcess = ReturnType<typeof Bun.spawn>;

export const DEFAULT_WHISPER_CHUNK_DURATION_MS = 10 * 60 * 1_000;

export const splitWhisperRangeIntoChunks = (
  range: WhisperTimeRange,
  chunkDurationMs = DEFAULT_WHISPER_CHUNK_DURATION_MS
): WhisperTimeRange[] => {
  const durationMs = Math.max(1, Math.round(chunkDurationMs));
  const chunks: WhisperTimeRange[] = [];
  for (let startMs = range.startMs; startMs < range.endMs; startMs += durationMs) {
    chunks.push({
      startMs,
      endMs: Math.min(range.endMs, startMs + durationMs),
    });
  }
  return chunks;
};

const formatWhisperRangeSlug = (range: WhisperTimeRange): string =>
  `${formatSubtitleRangeTime(range.startMs).replace(/[:.]/g, "-").replace(/-(\d{3})$/, "_$1")}-${formatSubtitleRangeTime(range.endMs).replace(/[:.]/g, "-").replace(/-(\d{3})$/, "_$1")}`;

const isPartialWhisperRange = (
  range: WhisperTimeRange | undefined,
  durationMs?: number
): range is WhisperTimeRange => {
  if (!range) return false;
  if (typeof durationMs !== "number") return true;
  return range.startMs > 0 || range.endMs < durationMs;
};

export const getDefaultWhisperOutputBasePath = (
  videoPath: string,
  range?: WhisperTimeRange,
  durationMs?: number
): string => {
  const extension = extname(videoPath);
  const fileStem = basename(videoPath, extension);
  const rangeSuffix = isPartialWhisperRange(range, durationMs)
    ? `.${formatWhisperRangeSlug(range)}`
    : "";
  return join(dirname(videoPath), `${fileStem}.whisper${rangeSuffix}`);
};

export const getDefaultWhisperOutputBasePathForRanges = (
  videoPath: string,
  ranges: WhisperTimeRange[],
  durationMs?: number
): string => {
  if (ranges.length <= 1) {
    return getDefaultWhisperOutputBasePath(videoPath, ranges[0], durationMs);
  }
  const extension = extname(videoPath);
  const fileStem = basename(videoPath, extension);
  return join(dirname(videoPath), `${fileStem}.whisper.segments`);
};

export const getAvailableWhisperOutputPathForRanges = (
  videoPath: string,
  checkExists: (filePath: string) => boolean = existsSync,
  _ranges: WhisperTimeRange[],
  _durationMs?: number
): string => {
  const extension = extname(videoPath);
  const outputBasePath = join(dirname(videoPath), basename(videoPath, extension));
  const defaultPath = `${outputBasePath}.srt`;
  if (!checkExists(defaultPath)) return defaultPath;

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${outputBasePath}-${index}.srt`;
    if (!checkExists(candidate)) return candidate;
  }
  throw new Error("无法生成可用的字幕输出路径");
};

export const buildExtractWhisperAudioCommand = ({
  videoPath,
  audioPath,
  ffmpegPath = "ffmpeg",
  range,
}: {
  videoPath: string;
  audioPath: string;
  ffmpegPath?: string;
  range?: WhisperTimeRange;
}): string[] => {
  const rangeArgs =
    range && range.endMs > range.startMs
      ? [
          "-ss",
          formatSubtitleRangeTime(range.startMs),
          "-i",
          videoPath,
          "-t",
          formatSubtitleRangeTime(range.endMs - range.startMs),
        ]
      : ["-i", videoPath];

  return [
    ffmpegPath,
    "-nostdin",
    "-y",
    ...rangeArgs,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    audioPath,
  ];
};

const shellSafeTextPattern = /^[A-Za-z0-9_/:=.,@%+-]+$/;

export const formatCommandForDisplay = (command: string[]): string =>
  command
    .map((part) =>
      shellSafeTextPattern.test(part)
        ? part
        : `'${part.replace(/'/g, "'\\''")}'`
    )
    .join(" ");

const parseSrtTimestamp = (timestamp: string): number | null => {
  const matched = timestamp.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);
  if (!matched) return null;
  const [, hoursText, minutesText, secondsText, msText] = matched;
  const hours = Number.parseInt(hoursText ?? "", 10);
  const minutes = Number.parseInt(minutesText ?? "", 10);
  const seconds = Number.parseInt(secondsText ?? "", 10);
  const milliseconds = Number.parseInt(msText ?? "", 10);
  if (![hours, minutes, seconds, milliseconds].every(Number.isFinite)) {
    return null;
  }
  return (
    hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + milliseconds
  );
};

export const offsetSrtTimestamps = (
  srtContent: string,
  offsetMs: number
): string =>
  srtContent.replace(
    /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/g,
    (line, startText: string, endText: string) => {
      const startMs = parseSrtTimestamp(startText);
      const endMs = parseSrtTimestamp(endText);
      if (startMs === null || endMs === null) return line;
      return `${formatSubtitleRangeTime(startMs + offsetMs, ",")} --> ${formatSubtitleRangeTime(endMs + offsetMs, ",")}`;
    }
  );

const MAX_SUBTITLE_CUE_DURATION_MS = 5_000;

export const normalizeSrtCueDurations = (
  srtContent: string,
  maxDurationMs = MAX_SUBTITLE_CUE_DURATION_MS
): string =>
  srtContent.replace(
    /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/g,
    (line, startText: string, endText: string) => {
      const startMs = parseSrtTimestamp(startText);
      const endMs = parseSrtTimestamp(endText);
      if (startMs === null || endMs === null) return line;
      const normalizedEndMs = Math.min(endMs, startMs + maxDurationMs);
      return `${formatSubtitleRangeTime(startMs, ",")} --> ${formatSubtitleRangeTime(normalizedEndMs, ",")}`;
    }
  );

export const mergeSrtSegments = (
  segments: Array<{ content: string; offsetMs: number }>
): string => {
  const blocks: string[] = [];
  let subtitleIndex = 1;

  for (const segment of segments) {
    const offsetContent = offsetSrtTimestamps(
      segment.content.trim(),
      segment.offsetMs
    ).trim();
    if (!offsetContent) continue;

    for (const block of offsetContent.split(/\r?\n\s*\r?\n/)) {
      const lines = block.trim().split(/\r?\n/);
      if (lines.length === 0) continue;
      if (/^\d+$/.test(lines[0]?.trim() ?? "")) {
        lines[0] = String(subtitleIndex);
      } else {
        lines.unshift(String(subtitleIndex));
      }
      blocks.push(lines.join("\n"));
      subtitleIndex += 1;
    }
  }

  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
};

const readTranscriptionProgress = async (
  stream: ReadableStream<Uint8Array> | null,
  onProgress: ((progress: WhisperTranscriptionProgress) => void) | undefined,
  parseProgress: (text: string) => WhisperTranscriptionProgress | null
): Promise<void> => {
  if (!stream || !onProgress) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pendingText = "";
  let isDone = false;

  while (!isDone) {
    const { done, value } = await reader.read();
    isDone = done;
    pendingText += decoder.decode(value, { stream: !done });
    const lines = pendingText.split(/\r?\n/);
    pendingText = done ? "" : lines.pop() ?? "";

    for (const line of lines) {
      const progress = parseProgress(line);
      if (progress) onProgress(progress);
    }
  }
};

const readFasterWhisperProgress = async (
  stream: ReadableStream<Uint8Array> | null,
  onProgress?: (progress: WhisperTranscriptionProgress) => void
): Promise<void> =>
  readTranscriptionProgress(stream, onProgress, parseFasterWhisperProgressText);

const readStreamText = (stream: ReadableStream<Uint8Array> | null) =>
  stream ? new Response(stream).text() : Promise.resolve("");

const createWhisperCancellationError = () => new Error("字幕生成已停止");

const throwIfAborted = (abortSignal?: AbortSignal) => {
  if (abortSignal?.aborted) {
    throw createWhisperCancellationError();
  }
};

export const parseWhisperVideoDurationMs = (text: string): number | null => {
  try {
    const parsed = JSON.parse(text) as {
      format?: { duration?: string | number | null };
    };
    const durationSeconds = Number(parsed.format?.duration);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
    return Math.round(durationSeconds * 1_000);
  } catch {
    return null;
  }
};

const runCommand = async (
  command: string[],
  deps: {
    spawn: (
      command: string[],
      options: Parameters<typeof Bun.spawn>[1]
    ) => SpawnProcess;
    onStdout?: (stream: ReadableStream<Uint8Array> | null) => Promise<void>;
    abortSignal?: AbortSignal;
  }
): Promise<string> => {
  throwIfAborted(deps.abortSignal);

  let process: SpawnProcess;
  try {
    process = deps.spawn(command, { stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      throw new Error(`未找到命令: ${command[0]}`);
    }
    throw new Error(message);
  }

  let removeAbortListener: (() => void) | null = null;
  const abortPromise = new Promise<never>((_, reject) => {
    const abort = () => {
      process.kill();
      reject(createWhisperCancellationError());
    };
    if (deps.abortSignal?.aborted) {
      abort();
      return;
    }
    deps.abortSignal?.addEventListener("abort", abort, { once: true });
    removeAbortListener = () =>
      deps.abortSignal?.removeEventListener("abort", abort);
  });

  const [exitCode, stderrText] = await Promise.race([
    Promise.all([
      process.exited,
      readStreamText(process.stderr as ReadableStream<Uint8Array>),
      deps.onStdout?.(process.stdout as ReadableStream<Uint8Array>),
    ]),
    abortPromise,
  ]).finally(() => {
    removeAbortListener?.();
  });

  if (exitCode !== 0) {
    throw new Error(stderrText.trim() || `${command[0]} exited with code ${exitCode}`);
  }

  return stderrText;
};

export const probeWhisperVideoDurationMs = async (
  videoPath: string,
  deps: {
    resolveExecutable?: (executable: string) => string;
    spawn?: (
      command: string[],
      options: Parameters<typeof Bun.spawn>[1]
    ) => SpawnProcess;
  } = {}
): Promise<number> => {
  const resolveExecutable = deps.resolveExecutable ?? resolveCliExecutable;
  const spawn =
    deps.spawn ?? ((command, options) => Bun.spawn(command, options));
  const command = [
    resolveExecutable("ffprobe"),
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    videoPath,
  ];

  let process: SpawnProcess;
  try {
    process = spawn(command, { stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      throw new Error("未找到 ffprobe，请先安装 ffmpeg");
    }
    throw new Error(message);
  }

  const [exitCode, stdoutText, stderrText] = await Promise.all([
    process.exited,
    new Response(process.stdout as ReadableStream<Uint8Array>).text(),
    new Response(process.stderr as ReadableStream<Uint8Array>).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(stderrText.trim() || `ffprobe exited with code ${exitCode}`);
  }

  const durationMs = parseWhisperVideoDurationMs(stdoutText);
  if (durationMs === null) {
    throw new Error("无法读取视频时长");
  }
  return durationMs;
};

export const transcribeVideoSubtitle = async (
  input: WhisperTranscriptionRequest,
  deps: {
    existsSync?: typeof existsSync;
    makeTempAudioPath?: () => string;
    resolveExecutable?: (executable: string) => string;
    rm?: (path: string, options?: { force?: boolean }) => Promise<void>;
    readFile?: (path: string, encoding: "utf-8") => Promise<string>;
    writeFile?: (
      path: string,
      content: string,
      encoding: "utf-8"
    ) => Promise<void>;
    makeTempOutputBasePath?: (segmentIndex: number) => string;
    chunkDurationMs?: number;
    spawn?: (
      command: string[],
      options: Parameters<typeof Bun.spawn>[1]
    ) => SpawnProcess;
    abortSignal?: AbortSignal;
    onProgress?: (progress: WhisperTranscriptionProgress) => void;
  } = {}
): Promise<WhisperTranscriptionResult> => {
  const checkExists = deps.existsSync ?? existsSync;
  const resolveExecutable = deps.resolveExecutable ?? resolveCliExecutable;
  const spawn =
    deps.spawn ?? ((command, options) => Bun.spawn(command, options));
  const removeFile = deps.rm ?? defaultRm;
  const readFile = deps.readFile ?? defaultReadFile;
  const writeFile = deps.writeFile ?? defaultWriteFile;
  const language = input.language.trim() || "auto";
  const range =
    typeof input.startMs === "number" && typeof input.endMs === "number"
      ? { startMs: input.startMs, endMs: input.endMs }
      : undefined;
  const segmentRanges = range
    ? splitWhisperRangeIntoChunks(range, deps.chunkDurationMs)
    : [undefined];
  const shouldMergeSegments = segmentRanges.length > 1;
  const totalSegmentDurationMs = segmentRanges.reduce(
    (total, segmentRange) =>
      total +
      (segmentRange ? segmentRange.endMs - segmentRange.startMs : 0),
    0,
  );

  if (!checkExists(input.videoPath)) {
    throw new Error(`视频文件不存在: ${input.videoPath}`);
  }
  if (!checkExists(input.modelPath)) {
    throw new Error(`模型文件不存在: ${input.modelPath}`);
  }
  if (range && range.startMs >= range.endMs) {
    throw new Error("开始时间必须早于结束时间");
  }
  throwIfAborted(deps.abortSignal);

  const outputBasePath = input.outputPath.replace(/\.srt$/i, "");
  const tempPaths: string[] = [];
  const srtSegments: Array<{ content: string; offsetMs: number }> = [];

  try {
    for (const [segmentIndex, segmentRange] of segmentRanges.entries()) {
      const segmentNumber = segmentIndex + 1;
      const segmentTotal = segmentRanges.length;
      const segmentLabel =
        segmentTotal > 1 ? `第 ${segmentNumber}/${segmentTotal} 段` : "";
      const audioPath =
        deps.makeTempAudioPath?.() ??
        join(
          dirname(input.outputPath),
          `.${basename(outputBasePath)}.${Date.now()}.${segmentNumber}.wav`
        );
      tempPaths.push(audioPath);

      const segmentOutputBasePath = shouldMergeSegments
        ? deps.makeTempOutputBasePath?.(segmentNumber) ??
          join(
            dirname(input.outputPath),
            `.${basename(outputBasePath)}.${Date.now()}.part-${segmentNumber}`
          )
        : outputBasePath;
      if (shouldMergeSegments) tempPaths.push(`${segmentOutputBasePath}.srt`);

      deps.onProgress?.({
        phase: "extracting",
        message: segmentLabel ? `正在抽取${segmentLabel}音频` : "正在抽取音频",
      });
      const extractCommand = buildExtractWhisperAudioCommand({
        videoPath: input.videoPath,
        audioPath,
        ffmpegPath: resolveExecutable("ffmpeg"),
        range: segmentRange,
      });
      deps.onProgress?.({
        phase: "command",
        command: formatCommandForDisplay(extractCommand),
        message: "正在执行音频抽取命令",
      });
      await runCommand(extractCommand, { spawn, abortSignal: deps.abortSignal });

      throwIfAborted(deps.abortSignal);
      deps.onProgress?.({
        phase: "transcribing",
        message: segmentLabel ? `正在识别${segmentLabel}字幕` : "正在识别字幕",
      });
      const whisperCommand = buildFasterWhisperCommand({
        pythonPath: resolveExecutable(
          input.fasterWhisperPythonPath?.trim() || "python3"
        ),
        modelPath: input.modelPath,
        audioPath,
        outputPath: `${segmentOutputBasePath}.srt`,
        language,
      });
      deps.onProgress?.({
        phase: "command",
        command: formatCommandForDisplay(whisperCommand),
        message: "正在执行 Faster Whisper 识别命令",
      });
      const completedSegmentDurationMs = segmentRanges
        .slice(0, segmentIndex)
        .reduce(
          (total, completedRange) =>
            total +
            (completedRange
              ? completedRange.endMs - completedRange.startMs
              : 0),
          0,
        );
      const onSegmentProgress = (progress: WhisperTranscriptionProgress) => {
        if (
          segmentTotal <= 1 ||
          progress.phase !== "transcribing" ||
          typeof progress.percent !== "number"
        ) {
          deps.onProgress?.(progress);
          return;
        }

        const percent = getOverallTranscriptionPercent({
          completedDurationMs: completedSegmentDurationMs,
          currentDurationMs: segmentRange
            ? segmentRange.endMs - segmentRange.startMs
            : 0,
          totalDurationMs: totalSegmentDurationMs,
          currentPercent: progress.percent,
        });
        deps.onProgress?.({
          ...progress,
          percent,
          message: `正在识别${segmentLabel}字幕 ${progress.percent}%`,
        });
      };
      await runCommand(whisperCommand, {
        spawn,
        onStdout: (stream) => readFasterWhisperProgress(stream, onSegmentProgress),
        abortSignal: deps.abortSignal,
      });

      if (shouldMergeSegments) {
        srtSegments.push({
          content: await readFile(`${segmentOutputBasePath}.srt`, "utf-8"),
          offsetMs: segmentRange?.startMs ?? 0,
        });
      }
    }

    const normalizedOutputContent = shouldMergeSegments
      ? normalizeSrtCueDurations(mergeSrtSegments(srtSegments))
      : normalizeSrtCueDurations(
          range && range.startMs > 0
            ? offsetSrtTimestamps(
                await readFile(input.outputPath, "utf-8"),
                range.startMs
              )
            : await readFile(input.outputPath, "utf-8")
        );
    await writeFile(input.outputPath, normalizedOutputContent, "utf-8");

    deps.onProgress?.({ phase: "completed", message: "字幕已生成" });
    return {
      outputPath: input.outputPath,
    };
  } finally {
    await Promise.all(
      tempPaths.map((path) =>
        removeFile(path, { force: true }).catch(() => undefined)
      )
    );
  }
};

export const transcribeVideoSubtitleRanges = async (
  input: WhisperMultiRangeTranscriptionRequest,
  deps: {
    makeTempOutputPath?: (rangeIndex: number) => string;
    transcribeRange?: (
      input: WhisperTranscriptionRequest,
      options: {
        abortSignal?: AbortSignal;
        onProgress?: (progress: WhisperTranscriptionProgress) => void;
        resolveExecutable?: (executable: string) => string;
      }
    ) => Promise<WhisperTranscriptionResult>;
    readFile?: (path: string, encoding: "utf-8") => Promise<string>;
    writeFile?: (
      path: string,
      content: string,
      encoding: "utf-8"
    ) => Promise<void>;
    rm?: (path: string, options?: { force?: boolean }) => Promise<void>;
    abortSignal?: AbortSignal;
    onProgress?: (progress: WhisperTranscriptionProgress) => void;
    resolveExecutable?: (executable: string) => string;
  } = {}
): Promise<WhisperMultiRangeTranscriptionResult> => {
  const ranges = [...input.ranges].sort(
    (left, right) => left.startMs - right.startMs
  );
  if (ranges.length === 0) throw new Error("请至少设置一个有效字幕片段");
  for (const [index, range] of ranges.entries()) {
    if (range.startMs < 0 || range.startMs >= range.endMs) {
      throw new Error("开始时间必须早于结束时间");
    }
    const previousRange = ranges[index - 1];
    if (previousRange && range.startMs < previousRange.endMs) {
      throw new Error("字幕片段不能重叠");
    }
  }

  const readFile = deps.readFile ?? defaultReadFile;
  const writeFile = deps.writeFile ?? defaultWriteFile;
  const removeFile = deps.rm ?? defaultRm;
  const transcribeRange = deps.transcribeRange ?? transcribeVideoSubtitle;
  const singleRangeInput = input;
  const successfulSrtSegments: Array<{ content: string; offsetMs: number }> = [];
  const completedRanges: WhisperTimeRange[] = [];
  const failedRanges: Array<{ range: WhisperTimeRange; error: string }> = [];
  const totalRangeDurationMs = ranges.reduce(
    (total, range) => total + (range.endMs - range.startMs),
    0,
  );
  let interruptedRange: WhisperTimeRange | null = null;
  let pendingRanges: WhisperTimeRange[] = [];
  let stopped = false;
  let latestOverallPercent = 0;

  for (const [rangeIndex, range] of ranges.entries()) {
    const rangeNumber = rangeIndex + 1;
    const completedRangeDurationMs = ranges
      .slice(0, rangeIndex)
      .reduce(
        (total, completedRange) =>
          total + completedRange.endMs - completedRange.startMs,
        0,
      );
    const rangeOutputPath =
      deps.makeTempOutputPath?.(rangeNumber) ??
      join(
        dirname(input.outputPath),
        `.${basename(input.outputPath, extname(input.outputPath))}.${Date.now()}.user-range-${rangeNumber}.srt`
      );
    try {
      let currentRangePercent = 0;
      await transcribeRange(
        {
          ...singleRangeInput,
          outputPath: rangeOutputPath,
          startMs: range.startMs,
          endMs: range.endMs,
        },
        {
          abortSignal: deps.abortSignal,
          resolveExecutable: deps.resolveExecutable,
          onProgress: (progress) => {
            if (
              progress.phase === "transcribing" &&
              typeof progress.percent === "number"
            ) {
              currentRangePercent = progress.percent;
            } else if (progress.phase === "completed") {
              currentRangePercent = 100;
            }
            const overallPercent = getOverallTranscriptionPercent({
              completedDurationMs: completedRangeDurationMs,
              currentDurationMs: range.endMs - range.startMs,
              totalDurationMs: totalRangeDurationMs,
              currentPercent: currentRangePercent,
            });
            latestOverallPercent = Math.max(
              latestOverallPercent,
              overallPercent,
            );
            deps.onProgress?.({
              ...progress,
              overallPercent: latestOverallPercent,
              rangeIndex: rangeNumber,
              rangeTotal: ranges.length,
              range,
              message: `片段 ${rangeNumber}/${ranges.length} · ${progress.message}`,
            });
          },
        }
      );
      successfulSrtSegments.push({
        content: await readFile(rangeOutputPath, "utf-8"),
        offsetMs: 0,
      });
      completedRanges.push(range);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "字幕生成已停止") {
        stopped = true;
        interruptedRange = range;
        pendingRanges = ranges.slice(rangeIndex + 1);
        break;
      }
      failedRanges.push({ range, error: message });
      latestOverallPercent = getOverallTranscriptionPercent({
        completedDurationMs: completedRangeDurationMs,
        currentDurationMs: range.endMs - range.startMs,
        totalDurationMs: totalRangeDurationMs,
        currentPercent: 100,
      });
      deps.onProgress?.({
        phase: "range-failed",
        error: message,
        message: `片段 ${rangeNumber}/${ranges.length} 识别失败：${message}`,
        overallPercent: latestOverallPercent,
        rangeIndex: rangeNumber,
        rangeTotal: ranges.length,
        range,
      });
    } finally {
      await removeFile(rangeOutputPath, { force: true }).catch(() => undefined);
    }
  }

  const publishedOutputPath =
    completedRanges.length > 0 ? input.outputPath : null;
  if (publishedOutputPath) {
    await writeFile(
      publishedOutputPath,
      normalizeSrtCueDurations(mergeSrtSegments(successfulSrtSegments)),
      "utf-8"
    );
  }

  deps.onProgress?.({
    phase: "completed",
    overallPercent: stopped ? latestOverallPercent : 100,
    message: stopped
      ? `字幕生成已停止，已保留 ${completedRanges.length} 个片段`
      : `字幕已生成，成功 ${completedRanges.length} 个片段，失败 ${failedRanges.length} 个片段`,
  });
  return {
    outputPath: publishedOutputPath,
    completedRanges,
    failedRanges,
    interruptedRange,
    pendingRanges,
    stopped,
  };
};
