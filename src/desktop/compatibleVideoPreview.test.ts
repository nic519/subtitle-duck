import { describe, expect, test } from "bun:test";
import {
  buildCompatibleVideoPreviewCommand,
  buildLosslessCompatibleVideoPreviewCommand,
} from "./compatibleVideoPreview";

describe("compatible video preview commands", () => {
  const input = {
    ffmpegPath: "/usr/local/bin/ffmpeg",
    videoPath: "/media/source.mkv",
    outputPath: "/cache/preview.mp4",
  };

  test("re-muxes compatible sources without re-encoding", () => {
    expect(buildLosslessCompatibleVideoPreviewCommand(input)).toEqual([
      "/usr/local/bin/ffmpeg",
      "-nostdin",
      "-y",
      "-loglevel",
      "error",
      "-i",
      "/media/source.mkv",
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "/cache/preview.mp4",
    ]);
  });

  test("keeps the browser-compatible transcode fallback", () => {
    const command = buildCompatibleVideoPreviewCommand(input);
    expect(command).toContain("libx264");
    expect(command).toContain("aac");
    expect(command).toContain("scale=-2:480");
  });
});
