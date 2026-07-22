import { describe, expect, test } from "bun:test";
import {
  updateSubtitleTranslationUiState,
  type SubtitleTranslationUiState,
} from "./subtitleTranslationUiState";

const completedState: SubtitleTranslationUiState = {
  targetLanguage: "zh-CN",
  batchCharacters: 1500,
  translatedSubtitlePath: "/Volumes/JAV/ABP-123.en.zh.srt",
  progress: { message: "字幕翻译完成", percent: 100 },
  status: { tone: "success", message: "已翻译 42 条字幕" },
};

describe("subtitle translation UI state", () => {
  test("changing target language applies the sanitized setting and invalidates the completed result", () => {
    expect(
      updateSubtitleTranslationUiState(completedState, {
        type: "changeTargetLanguage",
        value: " en ",
      }),
    ).toEqual({
      ...completedState,
      targetLanguage: "en",
      translatedSubtitlePath: null,
      progress: { message: null, percent: null },
      status: { tone: "neutral", message: null },
    });
  });

  test("changing batch characters clamps the setting and invalidates the completed result", () => {
    expect(
      updateSubtitleTranslationUiState(completedState, {
        type: "changeBatchCharacters",
        value: 5000,
      }),
    ).toEqual({
      ...completedState,
      batchCharacters: 4000,
      translatedSubtitlePath: null,
      progress: { message: null, percent: null },
      status: { tone: "neutral", message: null },
    });
  });

  test("sanitizes invalid target and batch settings", () => {
    expect(
      updateSubtitleTranslationUiState(completedState, {
        type: "changeTargetLanguage",
        value: "   ",
      }).targetLanguage,
    ).toBe("zh-CN");
    expect(
      updateSubtitleTranslationUiState(completedState, {
        type: "changeBatchCharacters",
        value: 100,
      }).batchCharacters,
    ).toBe(200);
    expect(
      updateSubtitleTranslationUiState(completedState, {
        type: "changeBatchCharacters",
        value: Number.NaN,
      }).batchCharacters,
    ).toBe(1500);
  });
});
