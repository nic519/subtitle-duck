import { buildSubtitleTranslationOutputPath } from "./subtitleTranslation";

type TranslationProgress = {
  completedCueCount: number;
  totalCueCount: number;
  message: string;
};

type SubtitleTranslationSessionAdapter = {
  loadProxyUrl: () => Promise<string | null>;
  saveProxyUrl: (value: string) => Promise<unknown>;
  testConnection: (
    proxyUrl: string,
  ) => Promise<{ available: boolean; error: string | null }>;
  translate: (
    input: {
      subtitlePath: string;
      targetLanguage: string;
      sourceLanguage: string;
      maxBatchCharacters: number;
    },
    onProgress: (progress: TranslationProgress) => void,
  ) => Promise<{ outputPath: string; cueCount: number }>;
  cancel: (input: { subtitlePath: string }) => Promise<void>;
};

export type SubtitleTranslationSessionSnapshot = {
  status: "idle" | "ready" | "translating" | "canceling" | "completed" | "failed";
  subtitlePath: string | null;
  targetLanguage: string;
  batchCharacters: number;
  proxyUrl: string;
  connection: {
    status: "idle" | "testing" | "available" | "unavailable";
    error: string | null;
  };
  translatedPath: string | null;
  expectedOutputPath: string | null;
  progress: { message: string | null; percent: number | null };
  presentation: {
    tone: "neutral" | "success" | "error";
    message: string | null;
  };
};

const initialSnapshot = (): SubtitleTranslationSessionSnapshot => ({
  status: "idle",
  subtitlePath: null,
  targetLanguage: "zh-CN",
  batchCharacters: 1500,
  proxyUrl: "",
  connection: { status: "idle", error: null },
  translatedPath: null,
  expectedOutputPath: null,
  progress: { message: null, percent: null },
  presentation: { tone: "neutral", message: null },
});

const getExpectedOutputPath = (
  path: string | null,
  targetLanguage: string,
) => path ? buildSubtitleTranslationOutputPath(path, targetLanguage) : null;

export const createSubtitleTranslationSession = (
  adapter: SubtitleTranslationSessionAdapter,
) => {
  let snapshot = initialSnapshot();
  let translationIdentity: object | null = null;
  let connectionIdentity: object | null = null;
  const listeners = new Set<
    (value: SubtitleTranslationSessionSnapshot) => void
  >();

  const publish = (next: SubtitleTranslationSessionSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  };

  const invalidateResult = (
    update: Partial<
      Pick<
        SubtitleTranslationSessionSnapshot,
        "targetLanguage" | "batchCharacters"
      >
    >,
  ) => {
    const targetLanguage = update.targetLanguage ?? snapshot.targetLanguage;
    publish({
      ...snapshot,
      ...update,
      status: snapshot.subtitlePath ? "ready" : "idle",
      targetLanguage,
      translatedPath: null,
      expectedOutputPath: getExpectedOutputPath(
        snapshot.subtitlePath,
        targetLanguage,
      ),
      progress: { message: null, percent: null },
      presentation: { tone: "neutral", message: null },
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: (value: SubtitleTranslationSessionSnapshot) => void) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    async initialize() {
      const proxyUrl = (await adapter.loadProxyUrl())?.trim() || "";
      publish({ ...snapshot, proxyUrl });
    },
    selectFile(path: string) {
      const normalizedPath = path.trim();
      if (!normalizedPath) return false;
      if (!/\.srt$/i.test(normalizedPath)) {
        publish({
          ...snapshot,
          presentation: { tone: "error", message: "只支持 .srt 字幕文件" },
        });
        return false;
      }
      translationIdentity = null;
      publish({
        ...snapshot,
        status: "ready",
        subtitlePath: normalizedPath,
        translatedPath: null,
        expectedOutputPath: getExpectedOutputPath(
          normalizedPath,
          snapshot.targetLanguage,
        ),
        progress: { message: null, percent: null },
        presentation: { tone: "neutral", message: "已选择字幕，准备翻译" },
      });
      return true;
    },
    changeTargetLanguage(value: string) {
      invalidateResult({ targetLanguage: value.trim() || "zh-CN" });
    },
    changeBatchCharacters(value: number) {
      invalidateResult({
        batchCharacters: Number.isFinite(value)
          ? Math.min(4000, Math.max(200, value))
          : 1500,
      });
    },
    changeProxyUrl(value: string) {
      connectionIdentity = null;
      publish({
        ...snapshot,
        proxyUrl: value,
        connection: { status: "idle", error: null },
      });
      void adapter.saveProxyUrl(value.trim()).catch((error) => {
        publish({
          ...snapshot,
          presentation: {
            tone: "error",
            message: error instanceof Error ? error.message : String(error),
          },
        });
      });
    },
    async testConnection() {
      const identity = {};
      connectionIdentity = identity;
      publish({
        ...snapshot,
        connection: { status: "testing", error: null },
      });
      try {
        const result = await adapter.testConnection(snapshot.proxyUrl);
        if (connectionIdentity !== identity) return result;
        publish({
          ...snapshot,
          connection: {
            status: result.available ? "available" : "unavailable",
            error: result.error,
          },
        });
        return result;
      } catch (error) {
        if (connectionIdentity !== identity) throw error;
        const message = error instanceof Error ? error.message : String(error);
        publish({
          ...snapshot,
          connection: { status: "unavailable", error: message },
        });
        throw error;
      }
    },
    async start() {
      if (!snapshot.subtitlePath) {
        publish({
          ...snapshot,
          presentation: { tone: "error", message: "请先选择 SRT 字幕文件" },
        });
        return null;
      }
      const identity = {};
      translationIdentity = identity;
      const input = {
        subtitlePath: snapshot.subtitlePath,
        targetLanguage: snapshot.targetLanguage,
        sourceLanguage: "auto",
        maxBatchCharacters: snapshot.batchCharacters,
      };
      publish({
        ...snapshot,
        status: "translating",
        translatedPath: null,
        progress: { message: "准备翻译字幕", percent: 0 },
        presentation: { tone: "neutral", message: "正在翻译字幕" },
      });
      try {
        const result = await adapter.translate(input, (progress) => {
          if (translationIdentity !== identity) return;
          publish({
            ...snapshot,
            progress: {
              message: progress.message,
              percent:
                progress.totalCueCount > 0
                  ? (progress.completedCueCount / progress.totalCueCount) * 100
                  : 100,
            },
          });
        });
        if (translationIdentity !== identity) return result;
        publish({
          ...snapshot,
          status: "completed",
          translatedPath: result.outputPath,
          expectedOutputPath: result.outputPath,
          progress: {
            message: snapshot.progress.message ?? "字幕翻译完成",
            percent: 100,
          },
          presentation: {
            tone: "success",
            message: `已翻译 ${result.cueCount} 条字幕`,
          },
        });
        return result;
      } catch (error) {
        if (translationIdentity !== identity) throw error;
        const wasCancelled =
          error instanceof DOMException && error.name === "AbortError";
        const message = wasCancelled
          ? "已停止字幕翻译"
          : error instanceof Error
            ? error.message
            : String(error);
        publish({
          ...snapshot,
          status: "failed",
          progress: { message: null, percent: null },
          presentation: {
            tone: wasCancelled ? "neutral" : "error",
            message,
          },
        });
        throw error;
      }
    },
    async cancel() {
      if (!snapshot.subtitlePath || snapshot.status !== "translating") return;
      const identity = translationIdentity;
      const path = snapshot.subtitlePath;
      publish({
        ...snapshot,
        status: "canceling",
        presentation: { tone: "neutral", message: "正在停止翻译" },
      });
      try {
        await adapter.cancel({ subtitlePath: path });
      } catch (error) {
        if (
          translationIdentity === identity &&
          (snapshot as SubtitleTranslationSessionSnapshot).status === "canceling"
        ) {
          publish({
            ...snapshot,
            status: "translating",
            presentation: {
              tone: "error",
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
        throw error;
      }
    },
    report(
      tone: "neutral" | "success" | "error",
      message: string | null,
    ) {
      publish({
        ...snapshot,
        presentation: { tone, message },
      });
    },
    clear() {
      translationIdentity = null;
      connectionIdentity = null;
      publish({
        ...initialSnapshot(),
        targetLanguage: snapshot.targetLanguage,
        batchCharacters: snapshot.batchCharacters,
        proxyUrl: snapshot.proxyUrl,
      });
    },
  };
};

export type SubtitleTranslationSession = ReturnType<
  typeof createSubtitleTranslationSession
>;
