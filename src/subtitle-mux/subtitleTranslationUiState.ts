export type SubtitleTranslationUiState = {
  targetLanguage: string;
  batchCharacters: number;
  translatedSubtitlePath: string | null;
  progress: { message: string | null; percent: number | null };
  status: {
    tone: "neutral" | "success" | "error";
    message: string | null;
  };
};

export type SubtitleTranslationUiAction =
  | { type: "changeTargetLanguage"; value: string }
  | { type: "changeBatchCharacters"; value: number };

export const updateSubtitleTranslationUiState = (
  current: SubtitleTranslationUiState,
  action: SubtitleTranslationUiAction,
): SubtitleTranslationUiState => ({
  ...current,
  targetLanguage:
    action.type === "changeTargetLanguage"
      ? action.value.trim() || "zh-CN"
      : current.targetLanguage,
  batchCharacters:
    action.type === "changeBatchCharacters"
      ? Number.isFinite(action.value)
        ? Math.min(4000, Math.max(200, action.value))
        : 1500
      : current.batchCharacters,
  translatedSubtitlePath: null,
  progress: { message: null, percent: null },
  status: { tone: "neutral", message: null },
});
