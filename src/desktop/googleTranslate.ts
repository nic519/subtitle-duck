import type {
  MyJavProxyConfig,
  RawHttpMethod,
  RawHttpRequest,
} from "./httpRequest";

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

const DEFAULT_GOOGLE_TRANSLATE_BASE_URL = "https://translate.google.com";
const DEFAULT_GOOGLE_TRANSLATE_TIMEOUT_MS = 20_000;

const GOOGLE_TRANSLATE_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://translate.google.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const normalizeLanguage = (
  language: string | null | undefined,
  fallback: string
): string => language?.trim() || fallback;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const buildGoogleTranslateUrl = ({
  baseUrl,
  text,
  sourceLanguage,
  targetLanguage,
}: {
  baseUrl: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}): string => {
  const url = new URL("/translate_a/single", baseUrl);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLanguage);
  url.searchParams.set("tl", targetLanguage);
  url.searchParams.set("dt", "t");
  url.searchParams.set("dj", "1");
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("q", text);
  return url.toString();
};

export const parseGoogleTranslatePayload = (
  payloadText: string,
  context: {
    originalText: string;
    sourceLanguage: string;
    targetLanguage: string;
  }
): GoogleTranslateTextResult => {
  const payload = JSON.parse(payloadText) as unknown;
  if (!isRecord(payload)) {
    throw new Error("Google 翻译响应格式无效");
  }

  const sentences = Array.isArray(payload.sentences) ? payload.sentences : [];
  const translatedText = sentences
    .map((sentence) =>
      isRecord(sentence) && typeof sentence.trans === "string"
        ? sentence.trans
        : ""
    )
    .join("")
    .trim();

  if (!translatedText) {
    throw new Error("Google 翻译响应缺少译文");
  }

  return {
    provider: "google",
    originalText: context.originalText,
    translatedText,
    sourceLanguage: context.sourceLanguage,
    targetLanguage: context.targetLanguage,
    detectedSourceLanguage:
      typeof payload.src === "string" && payload.src.trim()
        ? payload.src.trim()
        : null,
  };
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
    if (!originalText) {
      throw new Error("翻译文本为空");
    }

    const normalizedSourceLanguage = normalizeLanguage(sourceLanguage, "auto");
    const normalizedTargetLanguage = normalizeLanguage(targetLanguage, "zh-CN");
    const method: RawHttpMethod = "GET";
    const responseText = await requestRaw(
      {
        url: buildGoogleTranslateUrl({
          baseUrl: options.baseUrl ?? DEFAULT_GOOGLE_TRANSLATE_BASE_URL,
          text: originalText,
          sourceLanguage: normalizedSourceLanguage,
          targetLanguage: normalizedTargetLanguage,
        }),
        method,
        headers: GOOGLE_TRANSLATE_HEADERS,
        timeoutMs: options.timeoutMs ?? DEFAULT_GOOGLE_TRANSLATE_TIMEOUT_MS,
        abortSignal,
      },
      options.proxyConfig
    );

    return parseGoogleTranslatePayload(responseText, {
      originalText,
      sourceLanguage: normalizedSourceLanguage,
      targetLanguage: normalizedTargetLanguage,
    });
  };
