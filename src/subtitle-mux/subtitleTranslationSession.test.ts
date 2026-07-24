import { describe, expect, test } from "bun:test";
import { createSubtitleTranslationSession } from "./subtitleTranslationSession";

describe("subtitle translation session", () => {
  test("completes a translation and invalidates the result when settings change", async () => {
    const session = createSubtitleTranslationSession({
      loadProxyUrl: async () => "",
      saveProxyUrl: async () => undefined,
      testConnection: async () => ({ available: true, error: null }),
      translate: async (_input, onProgress) => {
        onProgress({
          completedCueCount: 2,
          totalCueCount: 4,
          message: "已翻译 2/4",
        });
        return { outputPath: "/subs/movie.zh-CN.srt", cueCount: 4 };
      },
      cancel: async () => undefined,
    });

    session.selectFile("/subs/movie.srt");
    await session.start();
    expect(session.getSnapshot()).toMatchObject({
      status: "completed",
      translatedPath: "/subs/movie.zh-CN.srt",
      progress: { percent: 100 },
      presentation: { tone: "success", message: "已翻译 4 条字幕" },
    });

    session.changeTargetLanguage("en");
    expect(session.getSnapshot()).toMatchObject({
      status: "ready",
      targetLanguage: "en",
      translatedPath: null,
      progress: { message: null, percent: null },
      presentation: { tone: "neutral", message: null },
    });
  });

  test("retries through the same session after a translation failure", async () => {
    let attempts = 0;
    const session = createSubtitleTranslationSession({
      loadProxyUrl: async () => "",
      saveProxyUrl: async () => undefined,
      testConnection: async () => ({ available: true, error: null }),
      translate: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("网络暂时不可用");
        return { outputPath: "/subs/movie.zh-CN.srt", cueCount: 3 };
      },
      cancel: async () => undefined,
    });
    session.selectFile("/subs/movie.srt");

    await expect(session.start()).rejects.toThrow("网络暂时不可用");
    expect(session.getSnapshot()).toMatchObject({
      status: "failed",
      presentation: { tone: "error", message: "网络暂时不可用" },
    });

    await session.start();
    expect(session.getSnapshot()).toMatchObject({
      status: "completed",
      translatedPath: "/subs/movie.zh-CN.srt",
    });
  });

  test("publishes a neutral stopped result when cancellation aborts translation", async () => {
    let rejectTranslation: ((reason: unknown) => void) | null = null;
    const session = createSubtitleTranslationSession({
      loadProxyUrl: async () => "",
      saveProxyUrl: async () => undefined,
      testConnection: async () => ({ available: true, error: null }),
      translate: async () =>
        new Promise((_, reject) => {
          rejectTranslation = reject;
        }),
      cancel: async () => {
        rejectTranslation?.(new DOMException("翻译已停止", "AbortError"));
      },
    });
    session.selectFile("/subs/movie.srt");
    const running = session.start();

    await session.cancel();
    await expect(running).rejects.toThrow("翻译已停止");
    expect(session.getSnapshot()).toMatchObject({
      status: "failed",
      presentation: { tone: "neutral", message: "已停止字幕翻译" },
    });
  });

  test("does not roll a completed translation back when cancellation fails late", async () => {
    let finishTranslation:
      | ((result: { outputPath: string; cueCount: number }) => void)
      | null = null;
    let rejectCancel: ((reason: unknown) => void) | null = null;
    const session = createSubtitleTranslationSession({
      loadProxyUrl: async () => "",
      saveProxyUrl: async () => undefined,
      testConnection: async () => ({ available: true, error: null }),
      translate: async () => new Promise((resolve) => {
        finishTranslation = resolve;
      }),
      cancel: async () => new Promise((_, reject) => {
        rejectCancel = reject;
      }),
    });
    session.selectFile("/subs/movie.srt");
    const translating = session.start();
    const canceling = session.cancel();
    finishTranslation?.({ outputPath: "/subs/movie.zh-CN.srt", cueCount: 4 });
    await translating;
    rejectCancel?.(new Error("取消请求失败"));

    await expect(canceling).rejects.toThrow("取消请求失败");
    expect(session.getSnapshot()).toMatchObject({
      status: "completed",
      translatedPath: "/subs/movie.zh-CN.srt",
    });
  });

  test("discards a connection result after the proxy address changes", async () => {
    let finishConnection:
      | ((result: { available: boolean; error: string | null }) => void)
      | null = null;
    const session = createSubtitleTranslationSession({
      loadProxyUrl: async () => "",
      saveProxyUrl: async () => undefined,
      testConnection: async () => new Promise((resolve) => {
        finishConnection = resolve;
      }),
      translate: async () => ({ outputPath: "", cueCount: 0 }),
      cancel: async () => undefined,
    });
    const testing = session.testConnection();
    session.changeProxyUrl("http://127.0.0.1:7890");
    finishConnection?.({ available: true, error: null });
    await testing;

    expect(session.getSnapshot()).toMatchObject({
      proxyUrl: "http://127.0.0.1:7890",
      connection: { status: "idle", error: null },
    });
  });

  test("sanitizes translation settings through the session interface", () => {
    const session = createSubtitleTranslationSession({
      loadProxyUrl: async () => "",
      saveProxyUrl: async () => undefined,
      testConnection: async () => ({ available: true, error: null }),
      translate: async () => ({ outputPath: "", cueCount: 0 }),
      cancel: async () => undefined,
    });

    session.changeTargetLanguage("   ");
    session.changeBatchCharacters(100);
    expect(session.getSnapshot()).toMatchObject({
      targetLanguage: "zh-CN",
      batchCharacters: 200,
    });

    session.changeBatchCharacters(9_000);
    expect(session.getSnapshot().batchCharacters).toBe(4_000);
    session.changeBatchCharacters(Number.NaN);
    expect(session.getSnapshot().batchCharacters).toBe(1_500);
  });
});
