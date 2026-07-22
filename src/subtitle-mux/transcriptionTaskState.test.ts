import { describe, expect, test } from "bun:test";
import {
  completeWhisperTranscriptionTask,
  startWhisperTranscriptionTask,
  updateWhisperTranscriptionTask,
} from "./transcriptionTaskState";

describe("transcriptionTaskState", () => {
  test("retains the completed subtitle output after the progress listener is gone", () => {
    const started = startWhisperTranscriptionTask({
      videoPath: "/Volumes/JAV/IPX-535.mp4",
      ranges: [{ startMs: 0, endMs: 60_000 }],
      durationMs: 60_000,
      language: "ja",
    });
    const running = updateWhisperTranscriptionTask(started, {
      phase: "transcribing",
      percent: 42,
      message: "正在识别 42%",
    });
    const completed = completeWhisperTranscriptionTask(running, {
      outputPath: "/Volumes/JAV/IPX-535.whisper.srt",
      completedRanges: [{ startMs: 0, endMs: 60_000 }],
      failedRanges: [],
      interruptedRange: null,
      pendingRanges: [],
      stopped: false,
    });

    expect(completed).toMatchObject({
      status: "completed",
      progress: { percent: 42, message: "正在识别 42%" },
      result: { outputPath: "/Volumes/JAV/IPX-535.whisper.srt" },
    });
  });
});
