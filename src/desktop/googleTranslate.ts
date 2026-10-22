import { setTimeout as delay } from "node:timers/promises";
import type { MyJavProxyConfig, RawHttpRequest } from "./httpRequest";

export interface GoogleTranslateTextInput {
  text: string;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  abortSignal?: AbortSignal;
}

export interface GoogleTranslateTextResult {
  provider: "google";
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedSourceLanguage: string | null;
}

export type GoogleTranslateRequester = (
  request: RawHttpRequest,
  proxyConfig?: MyJavProxyConfig
) => Promise<string>;

export interface GoogleTranslateTextServiceOptions {
  baseUrl?: string;
  proxyConfig?: MyJavProxyConfig;
  timeoutMs?: number;
}

const DEFAULT_GOOGLE_TRANSLATE_TIMEOUT_MS = 20_000;

const normalizeLanguage = (
  language: string | null | undefined,
  fallback: string
): string => language?.trim() || fallback;

// 所有实例共享串行队列；启动间隔至少 150ms，覆盖批量拆分后的并发回退。
// 请求失败只影响调用方，不阻塞后续请求；已取消的排队任务不再联网。
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = -Infinity;

const enqueueRequest = <T>(
  request: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> => {
  const pending = requestQueue.then(async () => {
    signal?.throwIfAborted();
    const waitMs = 150 - (performance.now() - lastRequestStartedAt);
    if (waitMs > 0) await delay(Math.ceil(waitMs), undefined, { signal });
    signal?.throwIfAborted();
    lastRequestStartedAt = performance.now();
    return request();
  });
  requestQueue = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
};

// 使用沉浸式翻译默认的文本接口，保持调用方已有的译文返回结构。
export const createGoogleTranslateTextService =
  (
    requestRaw: GoogleTranslateRequester,
    options: GoogleTranslateTextServiceOptions = {}
  ) =>
  async ({
    text,
    sourceLanguage,
    targetLanguage,
    abortSignal,
  }: GoogleTranslateTextInput): Promise<GoogleTranslateTextResult> => {
    const originalText = text.trim();
    if (!originalText) throw new Error("翻译文本为空");

    const normalizedSourceLanguage = normalizeLanguage(sourceLanguage, "auto");
    const normalizedTargetLanguage = normalizeLanguage(targetLanguage, "zh-CN");
    const url = new URL(
      "/translate_a/t",
      options.baseUrl ?? "https://translate.googleapis.com"
    );
    url.search = new URLSearchParams({
      client: "gtx",
      dt: "t",
      sl: normalizedSourceLanguage,
      tl: normalizedTargetLanguage,
    }).toString();
    const responseText = await enqueueRequest(
      () => requestRaw({
        url: url.toString(),
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ q: originalText }).toString(),
        timeoutMs: options.timeoutMs ?? DEFAULT_GOOGLE_TRANSLATE_TIMEOUT_MS,
        abortSignal,
      }, options.proxyConfig),
      abortSignal
    );
    // 自动检测时返回 [[译文, 源语言]]；指定源语言时也可能只返回 [译文]。
    const response: unknown = JSON.parse(responseText);
    const entry: unknown = Array.isArray(response) ? response[0] : undefined;
    const textValue: unknown = Array.isArray(entry) ? entry[0] : entry;
    const translatedText = typeof textValue === "string" ? textValue.trim() : "";
    if (!translatedText) throw new Error("Google 翻译响应缺少译文");
    const detectedSourceLanguage = Array.isArray(entry) && typeof entry[1] === "string"
      ? entry[1].trim() || null : null;

    return {
      provider: "google",
      originalText,
      translatedText,
      sourceLanguage: normalizedSourceLanguage,
      targetLanguage: normalizedTargetLanguage,
      detectedSourceLanguage,
    };
  };
