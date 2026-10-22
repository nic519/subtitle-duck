import { useEffect, useRef, useState } from "react";
import { desktopApi } from "../../desktop/client";
import { createSubtitleTranslationSession } from "../../subtitle-mux/subtitleTranslationSession";
import { revealInFolder } from "../../utils/fileUtils";
import type { SubtitleMuxPageContentProps } from "./subtitleMuxPageTypes";
/** 封装翻译会话及连接配置；订阅随页面挂载，切换工具不丢失状态。 */
export function useSubtitleTranslation() {
  const subtitleTranslationSessionRef = useRef<ReturnType<
    typeof createSubtitleTranslationSession
  > | null>(null);

  if (!subtitleTranslationSessionRef.current) {
    subtitleTranslationSessionRef.current = createSubtitleTranslationSession({
      loadProxyEnabled: async () =>
        (await desktopApi.configGet("subtitle_translation_proxy_enabled")) ===
        "true",
      saveProxyEnabled: (value) =>
        desktopApi.configSet(
          "subtitle_translation_proxy_enabled",
          String(value),
        ),
      loadProxyUrl: () =>
        desktopApi.configGet("subtitle_translation_proxy_url"),
      saveProxyUrl: (value) =>
        desktopApi.configSet("subtitle_translation_proxy_url", value),
      testConnection: (proxyUrl) =>
        desktopApi.testSubtitleTranslationConnection(proxyUrl),
      translate: (input, onProgress) =>
        desktopApi.translateSubtitleFile(input, onProgress),
      cancel: (input) => desktopApi.cancelTranslateSubtitleFile(input),
    });
  }

  const [subtitleTranslation, setSubtitleTranslation] = useState(
    subtitleTranslationSessionRef.current.getSnapshot(),
  );

  const subtitleTranslationPath = subtitleTranslation.subtitlePath;

  const subtitleTranslationTargetLanguage = subtitleTranslation.targetLanguage;

  const subtitleTranslationBatchCharacters =
    subtitleTranslation.batchCharacters;

  const subtitleTranslationProxyUrl = subtitleTranslation.proxyUrl;

  const subtitleTranslationConnectionStatus =
    subtitleTranslation.connection.status;

  const subtitleTranslationConnectionError =
    subtitleTranslation.connection.error;

  const translatedSubtitlePath = subtitleTranslation.translatedPath;

  const subtitleTranslationProgress = subtitleTranslation.progress;

  const subtitleTranslationStatus = subtitleTranslation.presentation;

  const isTranslatingSubtitle =
    subtitleTranslation.status === "translating" ||
    subtitleTranslation.status === "canceling";

  const subtitleTranslationOutputPath = subtitleTranslation.expectedOutputPath;

  useEffect(() => {
    const session = subtitleTranslationSessionRef.current!;
    const unsubscribe = session.subscribe(setSubtitleTranslation);
    void session.initialize();
    return unsubscribe;
  }, []);

  const useSubtitleTranslationPath = (path: string) => {
    subtitleTranslationSessionRef.current!.selectFile(path);
  };

  const handleChooseSubtitleTranslationFile = async () => {
    try {
      const selectedPath = await desktopApi.selectSubtitleTranslationFile();
      if (!selectedPath) return;
      useSubtitleTranslationPath(selectedPath);
    } catch (error) {
      const wasCancelled =
        error instanceof DOMException && error.name === "AbortError";
      subtitleTranslationSessionRef.current!.report(
        wasCancelled ? "neutral" : "error",
        wasCancelled
          ? "已停止字幕翻译"
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
  };

  const handleCancelSubtitleTranslation = async () => {
    try {
      await subtitleTranslationSessionRef.current!.cancel();
    } catch {}
  };

  const handleDropSubtitleTranslationPaths = (paths: string[]) => {
    const selectedPath = paths.find((path) => path.trim().length > 0);
    if (!selectedPath) {
      subtitleTranslationSessionRef.current!.report(
        "error",
        "拖放没有读取到字幕文件，请重新拖入或使用选择字幕",
      );
      return;
    }
    useSubtitleTranslationPath(selectedPath);
  };

  const handleTranslateSubtitle = async () => {
    try {
      await subtitleTranslationSessionRef.current!.start();
    } catch {}
  };

  const handleChangeSubtitleTranslationTargetLanguage = (value: string) => {
    subtitleTranslationSessionRef.current!.changeTargetLanguage(value);
  };

  const handleChangeSubtitleTranslationBatchCharacters = (value: number) => {
    subtitleTranslationSessionRef.current!.changeBatchCharacters(value);
  };

  const handleChangeSubtitleTranslationProxyUrl = (value: string) => {
    subtitleTranslationSessionRef.current!.changeProxyUrl(value);
  };

  const handleTestSubtitleTranslationConnection = async () => {
    try {
      await subtitleTranslationSessionRef.current!.testConnection();
    } catch {}
  };

  const handleClearTranslation = () => {
    subtitleTranslationSessionRef.current!.clear();
  };

  const handleRevealTranslatedSubtitle = async () => {
    if (!translatedSubtitlePath) return;
    try {
      await revealInFolder(translatedSubtitlePath);
    } catch (error) {
      subtitleTranslationSessionRef.current!.report(
        "error",
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  return {
    subtitleTranslationPath: subtitleTranslationPath,
    subtitleTranslationTargetLanguage: subtitleTranslationTargetLanguage,
    subtitleTranslationOutputPath: subtitleTranslationOutputPath,
    subtitleTranslationBatchCharacters: subtitleTranslationBatchCharacters,
    subtitleTranslationProxyEnabled: subtitleTranslation.proxyEnabled,
    onChangeSubtitleTranslationProxyEnabled: (value) =>
      subtitleTranslationSessionRef.current!.changeProxyEnabled(value),
    subtitleTranslationProxyUrl: subtitleTranslationProxyUrl,
    subtitleTranslationConnectionStatus: subtitleTranslationConnectionStatus,
    subtitleTranslationConnectionError: subtitleTranslationConnectionError,
    subtitleTranslationProgressMessage: subtitleTranslationProgress.message,
    subtitleTranslationProgressPercent: subtitleTranslationProgress.percent,
    isTranslatingSubtitle: isTranslatingSubtitle,
    subtitleTranslationStatusTone: subtitleTranslationStatus.tone,
    subtitleTranslationStatusMessage: subtitleTranslationStatus.message,
    onChooseSubtitleTranslationFile: () =>
      void handleChooseSubtitleTranslationFile(),
    onChangeSubtitleTranslationTargetLanguage:
      handleChangeSubtitleTranslationTargetLanguage,
    onChangeSubtitleTranslationBatchCharacters:
      handleChangeSubtitleTranslationBatchCharacters,
    onChangeSubtitleTranslationProxyUrl:
      handleChangeSubtitleTranslationProxyUrl,
    onTestSubtitleTranslationConnection:
      handleTestSubtitleTranslationConnection,
    onCancelSubtitleTranslation: handleCancelSubtitleTranslation,
    onUseSubtitleTranslationPath: useSubtitleTranslationPath,
    onDropSubtitleTranslationPaths: handleDropSubtitleTranslationPaths,
    onTranslateSubtitle: () => void handleTranslateSubtitle(),
    onRevealTranslatedSubtitle: () => void handleRevealTranslatedSubtitle(),
    onClearTranslation: handleClearTranslation,
  } satisfies Partial<SubtitleMuxPageContentProps>;
}
