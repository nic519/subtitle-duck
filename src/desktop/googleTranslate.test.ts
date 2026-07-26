import { describe, expect, test } from "bun:test";
import { createGoogleTranslateTextService } from "./googleTranslate";

describe("createGoogleTranslateTextService", () => {
  test("translates through the Google single endpoint and preserves the result contract", async () => {
    const abortController = new AbortController();
    const seenRequests: Array<{
      url: string;
      method: string;
      body?: string;
      abortSignal?: AbortSignal;
    }> = [];
    const translateText = createGoogleTranslateTextService(async (request) => {
      seenRequests.push(request);
      return JSON.stringify({
        sentences: [{ trans: "你好" }],
        src: "en",
      });
    });

    await expect(
      translateText({
        text: " hello ",
        sourceLanguage: "",
        targetLanguage: " zh-CN ",
        abortSignal: abortController.signal,
      })
    ).resolves.toEqual({
      provider: "google",
      originalText: "hello",
      translatedText: "你好",
      sourceLanguage: "auto",
      targetLanguage: "zh-CN",
      detectedSourceLanguage: "en",
    });

    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0]?.method).toBe("POST");
    expect(seenRequests[0]?.abortSignal).toBe(abortController.signal);
    const url = new URL(seenRequests[0]?.url ?? "");
    expect(url.pathname).toBe("/translate_a/single");
    expect(url.searchParams.get("client")).toBe("at");
    const body = new URLSearchParams(seenRequests[0]?.body);
    expect(body.get("sl")).toBe("auto");
    expect(body.get("tl")).toBe("zh-CN");
    expect(body.get("q")).toBe("hello");
  });

  test("rejects empty text before sending a network request", async () => {
    const translateText = createGoogleTranslateTextService(async () => {
      throw new Error("request should not be sent");
    });

    await expect(
      translateText({ text: "   ", targetLanguage: "zh-CN" })
    ).rejects.toThrow("翻译文本为空");
  });

  test("returns no detected language when Google omits the source language", async () => {
    const translateText = createGoogleTranslateTextService(async () =>
      JSON.stringify({ sentences: [{ trans: "你好" }] })
    );

    await expect(
      translateText({ text: "hello", sourceLanguage: "auto" })
    ).resolves.toMatchObject({ detectedSourceLanguage: null });
  });
});
