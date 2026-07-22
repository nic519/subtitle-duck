import { existsSync, mkdirSync, statSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { createHash } from "node:crypto";
import { resolveCliExecutable } from "./cliExecutable";

type SpawnProcess = ReturnType<typeof Bun.spawn>;

const compatibleVideoPreviewProfile = "copy-or-h264-aac-480p-v3";

export type CompatibleVideoPreviewRequest = {
  videoPath: string;
  cacheDirectory: string;
};

export type CompatibleVideoPreviewResult = {
  previewPath: string;
  reused: boolean;
};

export const getCompatibleVideoPreviewCachePath = (
  videoPath: string,
  cacheDirectory: string,
  getStats: typeof statSync = statSync
): string => {
  const stats = getStats(videoPath);
  const sourceKey = `${videoPath}:${stats.size}:${stats.mtimeMs}:${compatibleVideoPreviewProfile}`;
  const digest = createHash("sha256").update(sourceKey).digest("hex").slice(0, 24);
  const sourceStem = basename(videoPath, extname(videoPath))
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "video";
  return join(cacheDirectory, `${sourceStem}.${digest}.preview.mp4`);
};

export const buildLosslessCompatibleVideoPreviewCommand = ({
  ffmpegPath,
  videoPath,
  outputPath,
}: {
  ffmpegPath: string;
  videoPath: string;
  outputPath: string;
}): string[] => [
  ffmpegPath,
  "-nostdin",
  "-y",
  "-loglevel",
  "error",
  "-i",
  videoPath,
  "-map",
  "0:v:0",
  "-map",
  "0:a:0?",
  "-c",
  "copy",
  "-movflags",
  "+faststart",
  outputPath,
];

export const buildCompatibleVideoPreviewCommand = ({
  ffmpegPath,
  videoPath,
  outputPath,
}: {
  ffmpegPath: string;
  videoPath: string;
  outputPath: string;
}): string[] => [
  ffmpegPath,
  "-nostdin",
  "-y",
  "-loglevel",
  "error",
  "-i",
  videoPath,
  "-map",
  "0:v:0",
  "-map",
  "0:a:0?",
  "-vf",
  "scale=-2:480",
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-crf",
  "28",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-ac",
  "2",
  "-movflags",
  "+faststart",
  outputPath,
];

const runFfmpeg = async ({
  command,
  spawn,
}: {
  command: string[];
  spawn: (command: string[], options: Parameters<typeof Bun.spawn>[1]) => SpawnProcess;
}): Promise<{ exitCode: number; stderrText: string; stdoutText: string }> => {
  const process = spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stderrText, stdoutText] = await Promise.all([
    process.exited,
    new Response(process.stderr as ReadableStream<Uint8Array>).text(),
    new Response(process.stdout as ReadableStream<Uint8Array>).text(),
  ]);
  return { exitCode, stderrText, stdoutText };
};

type MediaStream = {
  codec_type?: string;
  codec_name?: string;
  pix_fmt?: string;
};

/**
 * MP4 accepts many codecs, but the embedded Chromium player does not decode
 * all of them. Only use the lossless path for the conservative H.264 8-bit
 * 4:2:0 + AAC combination; everything else uses the reliable transcode path.
 */
const canUseLosslessMp4Preview = async ({
  ffprobePath,
  videoPath,
  spawn,
}: {
  ffprobePath: string;
  videoPath: string;
  spawn: (command: string[], options: Parameters<typeof Bun.spawn>[1]) => SpawnProcess;
}): Promise<boolean> => {
  let result: Awaited<ReturnType<typeof runFfmpeg>>;
  try {
    result = await runFfmpeg({
      command: [
        ffprobePath,
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,pix_fmt",
        "-of",
        "json",
        videoPath,
      ],
      spawn,
    });
  } catch {
    // ffprobe is normally bundled alongside ffmpeg. If it is unavailable,
    // retain the previous reliable behavior instead of preventing previews.
    return false;
  }
  if (result.exitCode !== 0) return false;

  let streams: MediaStream[];
  try {
    streams = (JSON.parse(result.stdoutText) as { streams?: MediaStream[] }).streams ?? [];
  } catch {
    return false;
  }
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  return (
    video?.codec_name === "h264" &&
    (video.pix_fmt === "yuv420p" || video.pix_fmt === "yuvj420p") &&
    (!audio || audio.codec_name === "aac")
  );
};

export const createCompatibleVideoPreview = async (
  input: CompatibleVideoPreviewRequest,
  deps: {
    existsSync?: typeof existsSync;
    mkdirSync?: typeof mkdirSync;
    resolveExecutable?: (executable: string) => string;
    spawn?: (
      command: string[],
      options: Parameters<typeof Bun.spawn>[1]
    ) => SpawnProcess;
  } = {}
): Promise<CompatibleVideoPreviewResult> => {
  const checkExists = deps.existsSync ?? existsSync;
  const makeDirectory = deps.mkdirSync ?? mkdirSync;
  const resolveExecutable = deps.resolveExecutable ?? resolveCliExecutable;
  const spawn =
    deps.spawn ?? ((command, options) => Bun.spawn(command, options));

  if (!checkExists(input.videoPath)) {
    throw new Error(`视频文件不存在: ${input.videoPath}`);
  }

  makeDirectory(input.cacheDirectory, { recursive: true });
  const previewPath = getCompatibleVideoPreviewCachePath(
    input.videoPath,
    input.cacheDirectory
  );
  if (checkExists(previewPath)) return { previewPath, reused: true };

  const temporaryPath = `${previewPath}.${crypto.randomUUID()}.tmp.mp4`;
  const ffmpegPath = resolveExecutable("ffmpeg");
  try {
    // MKV often only differs by its container. For known browser-compatible
    // H.264/AAC sources, re-mux to MP4 without touching the streams.
    const useLosslessPreview = await canUseLosslessMp4Preview({
      ffprobePath: resolveExecutable("ffprobe"),
      videoPath: input.videoPath,
      spawn,
    });
    if (useLosslessPreview) {
      const losslessResult = await runFfmpeg({
        command: buildLosslessCompatibleVideoPreviewCommand({
          ffmpegPath,
          videoPath: input.videoPath,
          outputPath: temporaryPath,
        }),
        spawn,
      });
      if (losslessResult.exitCode === 0) {
        await rename(temporaryPath, previewPath);
        return { previewPath, reused: false };
      }
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }

    const fallbackResult = await runFfmpeg({
      command: buildCompatibleVideoPreviewCommand({
        ffmpegPath,
        videoPath: input.videoPath,
        outputPath: temporaryPath,
      }),
      spawn,
    });

    if (fallbackResult.exitCode !== 0) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw new Error(
        fallbackResult.stderrText.trim() || `ffmpeg exited with code ${fallbackResult.exitCode}`
      );
    }
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      throw new Error("未找到 ffmpeg，请先安装并确认它在 PATH 中");
    }
    throw new Error(message);
  }

  await rename(temporaryPath, previewPath);
  return { previewPath, reused: false };
};
