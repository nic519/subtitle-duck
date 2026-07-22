import { describe, expect, test } from "bun:test";
import {
  buildSubtitleMuxOutputPath,
  classifySubtitleMuxDropPaths,
  extractSubtitleMuxDropPaths,
  mergeSubtitleMuxDraftWithDropPaths,
} from "./subtitleMuxModel";

describe("subtitleMuxModel", () => {
  test("extracts local file paths from file paths before URI fallbacks", () => {
    expect(
      extractSubtitleMuxDropPaths({
        filePaths: ["/Volumes/JAV/ABP-123.mp4", "/Volumes/JAV/ABP-123.srt"],
        uriList: "file:///Volumes/ignored/demo.mp4",
        plainText: "/Volumes/ignored/demo.srt",
      })
    ).toEqual(["/Volumes/JAV/ABP-123.mp4", "/Volumes/JAV/ABP-123.srt"]);
  });

  test("falls back to URI list and plain text paths", () => {
    expect(
      extractSubtitleMuxDropPaths({
        filePaths: [],
        uriList:
          "file:///Volumes/JAV/IPX-535.mp4\nfile:///Volumes/JAV/IPX-535.ass",
        plainText: "",
      })
    ).toEqual(["/Volumes/JAV/IPX-535.mp4", "/Volumes/JAV/IPX-535.ass"]);

    expect(
      extractSubtitleMuxDropPaths({
        filePaths: [],
        uriList: "",
        plainText: "/Volumes/JAV/SONE-001.mp4\n/Volumes/JAV/SONE-001.ssa",
      })
    ).toEqual(["/Volumes/JAV/SONE-001.mp4", "/Volumes/JAV/SONE-001.ssa"]);
  });

  test("normalizes CRLF file URI drops", () => {
    expect(
      extractSubtitleMuxDropPaths({
        filePaths: [],
        uriList:
          "file:///Volumes/JAV/IPX-535.mp4\r\nfile:///Volumes/JAV/IPX-535.ass",
        plainText: "",
      })
    ).toEqual(["/Volumes/JAV/IPX-535.mp4", "/Volumes/JAV/IPX-535.ass"]);
  });

  test("falls back to WebKit macOS file-url text types", () => {
    expect(
      extractSubtitleMuxDropPaths({
        filePaths: [],
        uriList: "",
        plainText: "",
        fallbackText: ["", "file:///Volumes/JAV/IPX-535.mp4"],
      })
    ).toEqual(["/Volumes/JAV/IPX-535.mp4"]);
  });

  test("classifies one video plus one subtitle and derives the mkv output", () => {
    expect(
      classifySubtitleMuxDropPaths([
        "/Volumes/JAV/ABP-123.mp4",
        "/Volumes/JAV/ABP-123.srt",
      ])
    ).toEqual({
      videoPath: "/Volumes/JAV/ABP-123.mp4",
      subtitlePath: "/Volumes/JAV/ABP-123.srt",
      outputPath: "/Volumes/JAV/ABP-123.muxed.mkv",
      error: null,
    });

    expect(buildSubtitleMuxOutputPath("/Volumes/JAV/ABP-123.mp4")).toBe(
      "/Volumes/JAV/ABP-123.muxed.mkv"
    );
  });

  test("rejects unsupported combinations early", () => {
    expect(classifySubtitleMuxDropPaths(["/Volumes/JAV/ABP-123.mp4"])).toEqual(
      {
        videoPath: "/Volumes/JAV/ABP-123.mp4",
        subtitlePath: null,
        outputPath: "/Volumes/JAV/ABP-123.muxed.mkv",
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
      outputPath: "/Volumes/JAV/ABP-123.muxed.mkv",
      error: "请拖入 1 个视频文件和 1 个字幕文件",
    });

    expect(
      mergeSubtitleMuxDraftWithDropPaths(videoOnly, [
        "/Volumes/JAV/ABP-123.srt",
      ])
    ).toEqual({
      videoPath: "/Volumes/JAV/ABP-123.mp4",
      subtitlePath: "/Volumes/JAV/ABP-123.srt",
      outputPath: "/Volumes/JAV/ABP-123.muxed.mkv",
      error: null,
    });
  });

  test("keeps the current draft visible when a drop exposes no local path", () => {
    expect(
      mergeSubtitleMuxDraftWithDropPaths(
        {
          videoPath: "/Volumes/JAV/ABP-123.mp4",
          subtitlePath: null,
          outputPath: "/Volumes/JAV/ABP-123.muxed.mkv",
          error: null,
        },
        []
      )
    ).toEqual({
      videoPath: "/Volumes/JAV/ABP-123.mp4",
      subtitlePath: null,
      outputPath: "/Volumes/JAV/ABP-123.muxed.mkv",
      error: "拖放没有读取到文件，请重新拖入或使用选择视频/选择字幕",
    });
  });
});
