import { describe, expect, test } from "bun:test";
import {
  buildSubtitleMuxOutputPath,
  classifySubtitleMuxDropPaths,
  mergeSubtitleMuxDraftWithDropPaths,
} from "./subtitleMuxModel";

describe("subtitleMuxModel", () => {
  test("classifies one video plus one subtitle and keeps MP4 output for SRT", () => {
    expect(
      classifySubtitleMuxDropPaths([
        "/Volumes/JAV/ABP-123.mp4",
        "/Volumes/JAV/ABP-123.srt",
      ])
    ).toEqual({
      videoPath: "/Volumes/JAV/ABP-123.mp4",
      subtitlePath: "/Volumes/JAV/ABP-123.srt",
      outputPath: "/Volumes/JAV/ABP-123.muxed.mp4",
      error: null,
    });

    expect(buildSubtitleMuxOutputPath("/Volumes/JAV/ABP-123.mp4", "/Volumes/JAV/ABP-123.srt")).toBe(
      "/Volumes/JAV/ABP-123.muxed.mp4"
    );
  });

  test("rejects unsupported combinations early", () => {
    expect(classifySubtitleMuxDropPaths(["/Volumes/JAV/ABP-123.mp4"])).toEqual(
      {
        videoPath: "/Volumes/JAV/ABP-123.mp4",
        subtitlePath: null,
        outputPath: "/Volumes/JAV/ABP-123.muxed.mp4",
        error: "请拖入 1 个视频文件和 1 个字幕文件",
      }
    );

    expect(
      classifySubtitleMuxDropPaths([
        "/Volumes/JAV/ABP-123.mp4",
        "/Volumes/JAV/ABP-123.vtt",
      ]).error
    ).toBe("只支持 srt、ass、ssa 字幕文件");
  });

  test("merges single-file drops with the existing draft", () => {
    const videoOnly = mergeSubtitleMuxDraftWithDropPaths(
      { videoPath: null, subtitlePath: null, outputPath: null, error: null },
      ["/Volumes/JAV/ABP-123.mp4"]
    );

    expect(videoOnly).toEqual({
      videoPath: "/Volumes/JAV/ABP-123.mp4",
      subtitlePath: null,
      outputPath: "/Volumes/JAV/ABP-123.muxed.mp4",
      error: "请拖入 1 个视频文件和 1 个字幕文件",
    });

    expect(
      mergeSubtitleMuxDraftWithDropPaths(videoOnly, [
        "/Volumes/JAV/ABP-123.srt",
      ])
    ).toEqual({
      videoPath: "/Volumes/JAV/ABP-123.mp4",
      subtitlePath: "/Volumes/JAV/ABP-123.srt",
      outputPath: "/Volumes/JAV/ABP-123.muxed.mp4",
      error: null,
    });
  });

  test("keeps the current draft visible when a drop exposes no local path", () => {
    expect(
      mergeSubtitleMuxDraftWithDropPaths(
        {
          videoPath: "/Volumes/JAV/ABP-123.mp4",
          subtitlePath: null,
          outputPath: "/Volumes/JAV/ABP-123.muxed.mp4",
          error: null,
        },
        []
      )
    ).toEqual({
      videoPath: "/Volumes/JAV/ABP-123.mp4",
      subtitlePath: null,
      outputPath: "/Volumes/JAV/ABP-123.muxed.mp4",
      error: "拖放没有读取到文件，请重新拖入或使用选择视频/选择字幕",
    });
  });
});


test("selects the container from both inputs, including Windows paths and uppercase extensions", () => {
  expect(buildSubtitleMuxOutputPath("C:\\videos\\Film.MP4", "C:\\subs\\Film.SRT")).toBe("C:\\videos\\Film.muxed.mp4");
  expect(buildSubtitleMuxOutputPath("/video.mp4", "/subtitle.ass")).toBe("/video.muxed.mkv");
  expect(buildSubtitleMuxOutputPath("/video.mp4", "/subtitle.ssa")).toBe("/video.muxed.mkv");
  expect(buildSubtitleMuxOutputPath("/video.mkv", "/subtitle.srt")).toBe("/video.muxed.mkv");
  expect(buildSubtitleMuxOutputPath("/video.mov", "/subtitle.srt")).toBe("/video.muxed.mkv");
});

test("updates the container when replacing either input, regardless of import order", () => {
  const empty = { videoPath: null, subtitlePath: null, outputPath: null, error: null };
  const subtitleFirst = mergeSubtitleMuxDraftWithDropPaths(empty, ["/subtitle.srt"]);
  const ready = mergeSubtitleMuxDraftWithDropPaths(subtitleFirst, ["/video.mp4"]);
  expect(ready.outputPath).toBe("/video.muxed.mp4");
  expect(ready.error).toBeNull();
  const styled = mergeSubtitleMuxDraftWithDropPaths(ready, ["/subtitle.ass"]);
  expect(styled.outputPath).toBe("/video.muxed.mkv");
  expect(mergeSubtitleMuxDraftWithDropPaths(styled, ["/subtitle.srt"]).outputPath).toBe("/video.muxed.mp4");
  expect(mergeSubtitleMuxDraftWithDropPaths(ready, ["/other.mkv"]).outputPath).toBe("/other.muxed.mkv");
});
