import { useEffect, useState } from "react";
import { desktopApi } from "../../desktop/client";
import {
  addSuccessfulFasterWhisperModel,
  parseFasterWhisperModelHistory,
} from "../../subtitle-mux/fasterWhisperModelHistory";
import type { SubtitleMuxPageContentProps } from "./subtitleMuxPageTypes";
const FASTER_WHISPER_MODEL_HISTORY_CONFIG_KEY =
  "faster_whisper_successful_model_history";
type FasterWhisperStatus = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};
/** 模型配置与历史独立于生成任务；下载选择不会自动替换本地模型。 */
export function useFasterWhisperSettings(
  setGenerationStatus: (status: {
    tone: "neutral" | "success" | "error";
    message: string | null;
  }) => void,
) {
  const [fasterWhisperStatus, setFasterWhisperStatus] =
    useState<FasterWhisperStatus | null>(null);

  const [fasterWhisperPythonPath, setFasterWhisperPythonPath] = useState<
    string | null
  >("python3");

  const [fasterWhisperModelPath, setFasterWhisperModelPath] = useState<
    string | null
  >(null);

  const [fasterWhisperModelHistory, setFasterWhisperModelHistory] = useState<
    string[]
  >([]);

  const refreshFasterWhisperStatus = async () => {
    const status = await desktopApi.getFasterWhisperStatus();
    setFasterWhisperStatus(status);
    return status;
  };

  useEffect(() => {
    void Promise.all([
      desktopApi.configGet("faster_whisper_python_path"),
      desktopApi.configGet("faster_whisper_model_path"),
      desktopApi.configGet(FASTER_WHISPER_MODEL_HISTORY_CONFIG_KEY),
      desktopApi.getFasterWhisperStatus(),
    ])
      .then(([pythonPath, modelPath, modelHistory, status]) => {
        setFasterWhisperPythonPath(pythonPath?.trim() || "python3");
        setFasterWhisperModelPath(modelPath?.trim() || null);
        setFasterWhisperModelHistory(
          parseFasterWhisperModelHistory(modelHistory),
        );
        setFasterWhisperStatus(status);
      })
      .catch((error) => {
        setFasterWhisperStatus({
          available: false,
          path: "python3",
          version: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, []);

  const saveFasterWhisperPythonPath = async (value: string) => {
    const path = value.trim() || "python3";
    try {
      await desktopApi.configSet(
        "faster_whisper_python_path",
        path === "python3" ? "" : path,
      );
      setFasterWhisperPythonPath(path);
      await refreshFasterWhisperStatus();
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const saveFasterWhisperModelPath = async (value: string) => {
    const path = value.trim();
    try {
      await desktopApi.configSet("faster_whisper_model_path", path);
      setFasterWhisperModelPath(path || null);
      await refreshFasterWhisperStatus();
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const rememberSuccessfulFasterWhisperModel = async () => {
    const nextHistory = addSuccessfulFasterWhisperModel(
      fasterWhisperModelHistory,
      fasterWhisperModelPath,
    );
    if (nextHistory === fasterWhisperModelHistory) return;

    setFasterWhisperModelHistory(nextHistory);
    try {
      await desktopApi.configSet(
        FASTER_WHISPER_MODEL_HISTORY_CONFIG_KEY,
        JSON.stringify(nextHistory),
      );
    } catch {
      // The generated subtitle is still valid when saving the convenience history fails.
    }
  };

  const handleChooseFasterWhisperPython = async () => {
    try {
      const selectedPath = await desktopApi.selectFasterWhisperPythonFile();
      if (!selectedPath) return;
      await saveFasterWhisperPythonPath(selectedPath);
      setGenerationStatus({
        tone: "success",
        message: "Faster Whisper Python 已设置",
      });
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleChooseFasterWhisperModel = async () => {
    try {
      const selectedPath = await desktopApi.selectFasterWhisperModelDirectory();
      if (!selectedPath) return;
      await saveFasterWhisperModelPath(selectedPath);
      setGenerationStatus({
        tone: "success",
        message: "Faster Whisper CT2 模型已设置",
      });
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return {
    rememberSuccessfulFasterWhisperModel,
    config: {
      fasterWhisperStatus: fasterWhisperStatus,
      fasterWhisperPythonPath: fasterWhisperPythonPath,
      fasterWhisperModelPath: fasterWhisperModelPath,
      fasterWhisperModelHistory: fasterWhisperModelHistory,
      onChooseFasterWhisperPython: () => void handleChooseFasterWhisperPython(),
      onChooseFasterWhisperModel: () => void handleChooseFasterWhisperModel(),
      onChangeFasterWhisperPythonPath: setFasterWhisperPythonPath,
      onSaveFasterWhisperPythonPath: (path) =>
        void saveFasterWhisperPythonPath(path),
      onChangeFasterWhisperModelPath: (path) =>
        setFasterWhisperModelPath(path || null),
      onSaveFasterWhisperModelPath: (path) =>
        void saveFasterWhisperModelPath(path),
      onRefreshFasterWhisperStatus: () => void refreshFasterWhisperStatus(),
    } satisfies Partial<SubtitleMuxPageContentProps>,
  };
}
