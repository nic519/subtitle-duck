import translate from "google-translate-api-x";
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

const resolveRequestUrl = (url: string, baseUrl?: string): string => {
  if (!baseUrl) return url;
  const googleUrl = new URL(url);
  return new URL(`${googleUrl.pathname}${googleUrl.search}`, baseUrl).toString();
};

const getDetectedSourceLanguage = (result: unknown): string | null => {
  if (!result || typeof result !== "object" || !("raw" in result)) {
    return null;
  }

  const raw = result.raw;
  if (!raw || typeof raw !== "object" || !("src" in raw)) {
    return null;
  }

  return typeof raw.src === "string" && raw.src.trim()
    ? raw.src.trim()
    : null;
};

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
    const result = await translate(originalText, {
      from: normalizedSourceLanguage,
      to: normalizedTargetLanguage,
      forceFrom: true,
      forceTo: true,
      forceBatch: false,
      fallbackBatch: false,
      requestOptions: { signal: abortSignal },
      requestFunction: async (url: string, requestOptions: RequestInit) => {
        const responseText = await requestRaw(
          {
            url: resolveRequestUrl(url, options.baseUrl),
            method: "POST",
            body:
              typeof requestOptions.body === "string"
                ? requestOptions.body
                : undefined,
            headers: requestOptions.headers as Record<string, string> | undefined,
            timeoutMs:
              options.timeoutMs ?? DEFAULT_GOOGLE_TRANSLATE_TIMEOUT_MS,
            abortSignal: requestOptions.signal ?? undefined,
          },
          options.proxyConfig
        );
        return new Response(responseText, { status: 200 });
      },
    });
    const translatedText = result.text.trim();
    if (!translatedText) throw new Error("Google 翻译响应缺少译文");

    return {
      provider: "google",
      originalText,
      translatedText,
      sourceLanguage: normalizedSourceLanguage,
      targetLanguage: normalizedTargetLanguage,
      detectedSourceLanguage: getDetectedSourceLanguage(result),
    };
  };
