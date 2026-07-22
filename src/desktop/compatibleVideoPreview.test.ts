import { describe, expect, test } from "bun:test";
import {
  buildCompatibleVideoPreviewCommand,
  buildLosslessCompatibleVideoPreviewCommand,
  buildStreamingCompatibleVideoPreviewCommand,
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
    expect(command).toContain("-skip_frame");
    expect(command).toContain("nokey");
    expect(command).toContain("-fps_mode");
    expect(command).toContain("passthrough");
    expect(command).toContain("libx264");
    expect(command).toContain("aac");
    expect(command).toContain("scale=-2:480");
  });

  test("streams fragmented MP4 from an arbitrary source timestamp", () => {
    const command = buildStreamingCompatibleVideoPreviewCommand({
      ffmpegPath: input.ffmpegPath,
      videoPath: input.videoPath,
      startMs: 12500,
    });

    expect(command).toContain("12.500");
    expect(command).toContain("frag_keyframe+empty_moov+default_base_moof");
    expect(command).toContain("pipe:1");
    expect(command).not.toContain("nokey");
  });
});
