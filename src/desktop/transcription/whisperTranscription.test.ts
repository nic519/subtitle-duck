import { describe, expect, test } from "bun:test";
import {
  getOverallTranscriptionPercent,
  transcribeVideoSubtitleRanges,
  type WhisperTranscriptionProgress,
} from "./whisperTranscription";

describe("getOverallTranscriptionPercent", () => {
  test("weights the current range by duration across the whole selection", () => {
    expect(
      getOverallTranscriptionPercent({
        completedDurationMs: 60_000,
        currentDurationMs: 180_000,
        totalDurationMs: 300_000,
        currentPercent: 50,
      }),
    ).toBe(50);
  });

  test("clamps the result to a valid percentage", () => {
    expect(
      getOverallTranscriptionPercent({
        completedDurationMs: 0,
        currentDurationMs: 60_000,
        totalDurationMs: 60_000,
        currentPercent: 120,
      }),
    ).toBe(100);
  });
});

describe("transcribeVideoSubtitleRanges progress", () => {
  test("reports duration-weighted overall progress for every selected range", async () => {
    const progressEvents: WhisperTranscriptionProgress[] = [];

    await transcribeVideoSubtitleRanges(
      {
        videoPath: "/video.mp4",
        outputPath: "/video.srt",
        modelPath: "/model",
        language: "ja",
        ranges: [
          { startMs: 0, endMs: 60_000 },
          { startMs: 120_000, endMs: 360_000 },
        ],
      },
      {
        makeTempOutputPath: (rangeNumber) => `/range-${rangeNumber}.srt`,
        transcribeRange: async (input, { onProgress }) => {
          onProgress?.({
            phase: "transcribing",
            percent: 50,
            message: "正在识别 50%",
          });
          onProgress?.({ phase: "completed", message: "字幕已生成" });
          return { outputPath: input.outputPath };
        },
        readFile: async () => "1\n00:00:00,000 --> 00:00:01,000\n字幕\n",
        writeFile: async () => undefined,
        rm: async () => undefined,
        onProgress: (progress) => progressEvents.push(progress),
      },
    );

    const rangeProgress = progressEvents.filter(
      (progress) => progress.phase === "transcribing",
    );
    expect(rangeProgress.map((progress) => progress.overallPercent)).toEqual([
      10, 60,
    ]);
  });

  test("keeps overall progress monotonic across chunk phase events", async () => {
    const progressEvents: WhisperTranscriptionProgress[] = [];

    await transcribeVideoSubtitleRanges(
      {
        videoPath: "/video.mp4",
        outputPath: "/video.srt",
        modelPath: "/model",
        language: "ja",
        ranges: [{ startMs: 0, endMs: 60_000 }],
      },
      {
        makeTempOutputPath: () => "/range.srt",
        transcribeRange: async (input, { onProgress }) => {
          onProgress?.({
            phase: "transcribing",
            percent: 40,
            message: "正在识别 40%",
          });
          onProgress?.({ phase: "extracting", message: "正在抽取下一分块音频" });
          onProgress?.({
            phase: "command",
            command: "ffmpeg next-chunk",
            message: "正在执行音频抽取命令",
          });
          onProgress?.({
            phase: "transcribing",
            percent: 60,
            message: "正在识别 60%",
          });
          onProgress?.({ phase: "completed", message: "字幕已生成" });
          return { outputPath: input.outputPath };
        },
        readFile: async () => "1\n00:00:00,000 --> 00:00:01,000\n字幕\n",
        writeFile: async () => undefined,
        rm: async () => undefined,
        onProgress: (progress) => progressEvents.push(progress),
      },
    );

    expect(progressEvents.map((progress) => progress.overallPercent)).toEqual([
      40, 40, 40, 60, 100, 100,
    ]);
  });

  test("does not mark a stopped task as fully processed", async () => {
    const progressEvents: WhisperTranscriptionProgress[] = [];

    const result = await transcribeVideoSubtitleRanges(
      {
        videoPath: "/video.mp4",
        outputPath: "/video.srt",
        modelPath: "/model",
        language: "ja",
        ranges: [
          { startMs: 0, endMs: 60_000 },
          { startMs: 120_000, endMs: 360_000 },
        ],
      },
      {
        makeTempOutputPath: () => "/range.srt",
        transcribeRange: async (_input, { onProgress }) => {
          onProgress?.({
            phase: "transcribing",
            percent: 50,
            message: "正在识别 50%",
          });
          throw new Error("字幕生成已停止");
        },
        rm: async () => undefined,
        onProgress: (progress) => progressEvents.push(progress),
      },
    );

    expect(result.stopped).toBe(true);
    expect(progressEvents.at(-1)?.overallPercent).toBe(10);
  });
});
