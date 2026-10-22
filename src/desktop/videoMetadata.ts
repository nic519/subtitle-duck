import { resolveCliExecutable } from "./cliExecutable";

/** 原文件探测结果；未知字段保留 null，避免将缺失数据误报为零。 */
export type VideoMetadata = {
  format: string | null;
  durationMs: number | null;
  sizeBytes: number | null;
  videoCodec: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  videoBitRate: number | null;
  totalBitRate: number | null;
  audioCodec: string | null;
  audioSampleRate: number | null;
  audioChannels: number | null;
};

const positiveNumber = (value: unknown): number | null => {
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** ffprobe 帧率可能是分数；无效分母不能产生 Infinity。 */
const frameRate = (value: unknown): number | null => {
  if (typeof value !== "string") return positiveNumber(value);
  const [numerator, denominator] = value.split("/");
  return denominator === undefined
    ? positiveNumber(numerator)
    : positiveNumber(Number(numerator) / Number(denominator));
};

/** 选择默认视频轨道，跳过音频文件附带的封面图。 */
export const parseVideoMetadata = (text: string): VideoMetadata => {
  const data = JSON.parse(text);
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  const videos = streams.filter((stream: { codec_type?: string; disposition?: { attached_pic?: number } }) => stream.codec_type === "video" && stream.disposition?.attached_pic !== 1);
  const video = videos.find((stream: { disposition?: { default?: number } }) => stream.disposition?.default === 1) ?? videos[0];
  if (!video) throw new Error("未找到视频轨道");
  const audio = streams.find((stream: { codec_type?: string }) => stream.codec_type === "audio");
  const format = data.format ?? {};
  const duration = positiveNumber(format.duration) ?? positiveNumber(video.duration);
  return {
    format: typeof format.format_name === "string" ? format.format_name : null,
    durationMs: duration === null ? null : Math.round(duration * 1000),
    sizeBytes: positiveNumber(format.size),
    videoCodec: typeof video.codec_name === "string" ? video.codec_name : null,
    width: positiveNumber(video.width),
    height: positiveNumber(video.height),
    frameRate: frameRate(video.avg_frame_rate) ?? frameRate(video.r_frame_rate),
    videoBitRate: positiveNumber(video.bit_rate),
    totalBitRate: positiveNumber(format.bit_rate),
    audioCodec: typeof audio?.codec_name === "string" ? audio.codec_name : null,
    audioSampleRate: positiveNumber(audio?.sample_rate),
    audioChannels: positiveNumber(audio?.channels),
  };
};

/** 在桌面进程中读取原文件；参数数组保证含空格的本地路径原样传递。 */
export const probeVideoMetadata = async (
  videoPath: string,
  resolveExecutable = resolveCliExecutable,
): Promise<VideoMetadata> => {
  const process = Bun.spawn([
    resolveExecutable("ffprobe"), "-v", "error", "-show_format", "-show_streams", "-of", "json", "-i", videoPath,
  ], { stdout: "pipe", stderr: "pipe" });
  // 探测超时必须终止子进程，防止损坏文件让界面一直处于读取中。
  const timer = setTimeout(() => process.kill(), 15000);
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);
    if (exitCode !== 0) throw new Error(stderr.trim() || "读取视频信息失败或超时");
    return parseVideoMetadata(stdout);
  } finally {
    clearTimeout(timer);
  }
};
