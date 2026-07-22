import { existsSync, mkdirSync, statSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { createHash } from "node:crypto";
import { resolveCliExecutable } from "./cliExecutable";

type SpawnProcess = ReturnType<typeof Bun.spawn>;

const compatibleVideoPreviewProfile = "h264-aac-480p-v2";

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
  let process: SpawnProcess;
  try {
    process = spawn(
      buildCompatibleVideoPreviewCommand({
        ffmpegPath: resolveExecutable("ffmpeg"),
        videoPath: input.videoPath,
        outputPath: temporaryPath,
      }),
      { stdout: "pipe", stderr: "pipe" }
    );
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
    new Response(process.stdout as ReadableStream<Uint8Array>).text(),
  ]);

  if (exitCode !== 0) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw new Error(stderrText.trim() || `ffmpeg exited with code ${exitCode}`);
  }

  await rename(temporaryPath, previewPath);
  return { previewPath, reused: false };
};
