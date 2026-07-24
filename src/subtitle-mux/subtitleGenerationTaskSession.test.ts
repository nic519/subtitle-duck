import { describe, expect, test } from "bun:test";
import type {
  WhisperMultiRangeTranscriptionResult,
  WhisperTranscriptionProgress,
} from "../desktop/transcription/whisperTranscription";
import { createSubtitleGenerationTaskSession } from "./subtitleGenerationTaskSession";

const input = {
  videoPath: "/videos/source.mp4",
  ranges: [{ startMs: 0, endMs: 60_000 }],
  durationMs: 60_000,
  language: "ja",
};

describe("subtitle generation task session", () => {
  test("publishes one restorable task view from start through completion", async () => {
    let reportProgress: ((progress: WhisperTranscriptionProgress) => void) | null = null;
    const result: WhisperMultiRangeTranscriptionResult = {
      outputPath: "/videos/source.whisper.srt",
      completedRanges: input.ranges,
      failedRanges: [],
      interruptedRange: null,
      pendingRanges: [],
      stopped: false,
    };
    const session = createSubtitleGenerationTaskSession({
      run: async (_input, onProgress) => {
        reportProgress = onProgress;
        await Promise.resolve();
        reportProgress({
          phase: "transcribing",
          overallPercent: 42,
          message: "正在识别 42%",
        });
        return result;
      },
      cancel: async () => undefined,
    });
    const snapshots: string[] = [];
    session.subscribe((snapshot) => snapshots.push(snapshot.status));

    await session.start(input);

    expect(snapshots).toEqual(["idle", "running", "running", "completed"]);
    expect(session.getSnapshot()).toMatchObject({
      status: "completed",
      input,
      progressMessage: "已生成 /videos/source.whisper.srt",
      progressPercent: 100,
      outputPath: "/videos/source.whisper.srt",
      presentation: { tone: "success", message: "已生成 /videos/source.whisper.srt" },
    });
  });

  test("keeps partial progress when cancellation completes with a stopped result", async () => {
    let finishRun:
      | ((result: WhisperMultiRangeTranscriptionResult) => void)
      | null = null;
    let reportProgress:
      | ((progress: WhisperTranscriptionProgress) => void)
      | null = null;
    const session = createSubtitleGenerationTaskSession({
      run: async (_input, onProgress) => {
        reportProgress = onProgress;
        return new Promise((resolve) => {
          finishRun = resolve;
        });
      },
      cancel: async () => {
        finishRun?.({
          outputPath: null,
          completedRanges: [],
          failedRanges: [],
          interruptedRange: input.ranges[0],
          pendingRanges: [],
          stopped: true,
        });
      },
    });
    const running = session.start(input);
    reportProgress?.({
      phase: "transcribing",
      overallPercent: 25,
      message: "正在识别 25%",
    });

    await session.cancel();
    await running;

    expect(session.getSnapshot()).toMatchObject({
      status: "completed",
      progressPercent: 25,
      presentation: { tone: "neutral" },
    });
  });

  test("does not roll a completed task back when the cancel request fails late", async () => {
    let finishRun:
      | ((result: WhisperMultiRangeTranscriptionResult) => void)
      | null = null;
    let rejectCancel: ((reason: unknown) => void) | null = null;
    const result: WhisperMultiRangeTranscriptionResult = {
      outputPath: "/videos/source.whisper.srt",
      completedRanges: input.ranges,
      failedRanges: [],
      interruptedRange: null,
      pendingRanges: [],
      stopped: false,
    };
    const session = createSubtitleGenerationTaskSession({
      run: async () => new Promise((resolve) => {
        finishRun = resolve;
      }),
      cancel: async () => new Promise((_, reject) => {
        rejectCancel = reject;
      }),
    });
    const running = session.start(input);
    const canceling = session.cancel();
    finishRun?.(result);
    await running;
    rejectCancel?.(new Error("取消请求失败"));

    await expect(canceling).rejects.toThrow("取消请求失败");
    expect(session.getSnapshot()).toMatchObject({
      status: "completed",
      outputPath: "/videos/source.whisper.srt",
    });
  });
});
