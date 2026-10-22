import { describe, expect, test } from "bun:test";
import { createGoogleTranslateTextService } from "./googleTranslate";

describe("createGoogleTranslateTextService", () => {
  test("translates through the Google t endpoint and preserves the result contract", async () => {
    const abortController = new AbortController();
    const seenRequests: Array<{
      url: string;
      method: string;
      body?: string;
      abortSignal?: AbortSignal;
    }> = [];
    const translateText = createGoogleTranslateTextService(async (request) => {
      seenRequests.push(request);
      return JSON.stringify([["你好", "en"]]);
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
    expect(url.origin).toBe("https://translate.googleapis.com");
    expect(url.pathname).toBe("/translate_a/t");
    expect(url.searchParams.get("client")).toBe("gtx");
    const body = new URLSearchParams(seenRequests[0]?.body);
    expect(url.searchParams.get("sl")).toBe("auto");
    expect(url.searchParams.get("tl")).toBe("zh-CN");
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
      JSON.stringify(["你好"])
    );

    await expect(
      translateText({ text: "hello", sourceLanguage: "auto" })
    ).resolves.toMatchObject({ detectedSourceLanguage: null });
  });
});

// 多个服务实例共用节流，避免单条回退和连接检测同时突发请求。
test("paces concurrent requests across service instances and recovers after failure", async () => {
  const starts: number[] = [];
  const request = async () => {
    starts.push(performance.now());
    if (starts.length === 1) throw new Error("HTTP 429");
    return JSON.stringify([["你好", "en"]]);
  };
  const first = createGoogleTranslateTextService(request);
  const second = createGoogleTranslateTextService(request);
  const results = await Promise.allSettled([
    first({ text: "one" }), second({ text: "two" }), first({ text: "three" }),
  ]);
  expect(results.map(result => result.status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
  expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(140);
  expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(140);
});

test("does not send a queued request after cancellation", async () => {
  let calls = 0;
  const service = createGoogleTranslateTextService(async () => {
    calls++;
    return JSON.stringify(["你好"]);
  });
  const controller = new AbortController();
  const first = service({ text: "one" });
  const canceled = service({ text: "two", abortSignal: controller.signal });
  controller.abort();
  const results = await Promise.allSettled([first, canceled]);
  expect(results[1]?.status).toBe("rejected");
  expect(calls).toBe(1);
});

test("rejects malformed or empty translations", async () => {
  for (const response of [[], [null], [[""]], { error: "invalid" }]) {
    const service = createGoogleTranslateTextService(async () => JSON.stringify(response));
    await expect(service({ text: "hello" })).rejects.toThrow("Google 翻译响应缺少译文");
  }
});
