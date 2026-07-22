import { readFile, writeFile } from "node:fs/promises";
import {
  buildSubtitleTranslationOutputPath,
  translateSrtContent,
  type SubtitleTranslationProgress,
  type SubtitleTranslateText,
} from "../../subtitle-mux/subtitleTranslation";

export type { SubtitleTranslationProgress };

export interface TranslateSubtitleFileInput {
  subtitlePath: string;
  targetLanguage?: string | null;
  sourceLanguage?: string | null;
  maxBatchCharacters?: number | null;
}

export interface TranslateSubtitleFileResult {
  outputPath: string;
  cueCount: number;
  targetLanguage: string;
}

const countSrtCues = (content: string): number =>
  content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .filter((block) =>
      block
        .split("\n")
        .some((line) =>
          /^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(
            line.trim()
          )
        )
    ).length;

export const translateSubtitleFile = async (
  {
    subtitlePath,
    targetLanguage = "zh-CN",
    sourceLanguage = "auto",
    maxBatchCharacters,
  }: TranslateSubtitleFileInput,
  {
    translateText,
    onProgress,
  }: {
    translateText: SubtitleTranslateText;
    onProgress?: (progress: SubtitleTranslationProgress) => void;
  }
): Promise<TranslateSubtitleFileResult> => {
  const normalizedSubtitlePath = subtitlePath.trim();
  if (!normalizedSubtitlePath) throw new Error("请选择 SRT 字幕文件");
  if (!/\.srt$/i.test(normalizedSubtitlePath)) {
    throw new Error("只支持 .srt 字幕文件");
  }

  const normalizedTargetLanguage = targetLanguage?.trim() || "zh-CN";
  const content = await readFile(normalizedSubtitlePath, "utf8");
  const translatedContent = await translateSrtContent(content, {
    targetLanguage: normalizedTargetLanguage,
    sourceLanguage,
    maxBatchCharacters: maxBatchCharacters ?? undefined,
    translateText,
    onProgress,
  });
  const outputPath = buildSubtitleTranslationOutputPath(
    normalizedSubtitlePath,
    normalizedTargetLanguage
  );
  await writeFile(outputPath, translatedContent, "utf8");

  return {
    outputPath,
    cueCount: countSrtCues(content),
    targetLanguage: normalizedTargetLanguage,
  };
};
