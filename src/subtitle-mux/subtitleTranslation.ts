export interface SubtitleTranslationRequest {
  text: string;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
}

export type SubtitleTranslateText = (
  request: SubtitleTranslationRequest
) => Promise<string>;

export interface SubtitleTranslationProgress {
  phase: "translating" | "translated" | "completed";
  completedCueCount: number;
  totalCueCount: number;
  currentCueIndex: number | null;
  message: string;
}

export interface TranslateSrtContentOptions {
  targetLanguage?: string;
  sourceLanguage?: string | null;
  maxBatchCharacters?: number;
  translateText: SubtitleTranslateText;
  onProgress?: (progress: SubtitleTranslationProgress) => void;
}

const SRT_TIME_LINE_PATTERN =
  /^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/;
const DEFAULT_SUBTITLE_TRANSLATION_BATCH_CHARACTERS = 1500;
const SENTENCE_END_PATTERN = /[。！？!?；;.…]+/g;
const TRAILING_SENTENCE_END_PATTERN = /[。！？!?；;.…]+$/;

const collapseRepeatedFragments = (text: string): string => {
  const characters = Array.from(text);
  const positionsByCharacter = new Map<string, number[]>();
  const occurrenceIndexByPosition: number[] = [];
  const result: string[] = [];
  let position = 0;

  characters.forEach((character, characterPosition) => {
    const positions = positionsByCharacter.get(character) ?? [];
    occurrenceIndexByPosition[characterPosition] = positions.length;
    positions.push(characterPosition);
    positionsByCharacter.set(character, positions);
  });

  while (position < characters.length) {
    let repeatedPhraseLength = 0;
    const candidateStarts = positionsByCharacter.get(characters[position]) ?? [];
    const maxCandidateStart =
      position + Math.floor((characters.length - position) / 3);

    for (
      let occurrenceIndex = occurrenceIndexByPosition[position] + 1;
      candidateStarts[occurrenceIndex] <= maxCandidateStart;
      occurrenceIndex += 1
    ) {
      const phraseLength = candidateStarts[occurrenceIndex] - position;
      if (characters[position + phraseLength * 2] !== characters[position]) {
        continue;
      }

      let matchesThreeTimes = true;
      for (
        let characterIndex = 1;
        characterIndex < phraseLength;
        characterIndex += 1
      ) {
        const character = characters[position + characterIndex];
        if (
          characters[position + phraseLength + characterIndex] !== character ||
          characters[position + phraseLength * 2 + characterIndex] !== character
        ) {
          matchesThreeTimes = false;
          break;
        }
      }

      if (
        matchesThreeTimes &&
        characters
          .slice(position, position + phraseLength)
          .every((character) => !/\s/u.test(character)) &&
        characters
          .slice(position, position + phraseLength)
          .some((character) => /[\p{L}\p{N}]/u.test(character))
      ) {
        repeatedPhraseLength = phraseLength;
        break;
      }
    }

    if (repeatedPhraseLength === 0) {
      result.push(characters[position]);
      position += 1;
      continue;
    }

    const phrase = characters.slice(
      position,
      position + repeatedPhraseLength
    );
    let occurrenceCount = 3;
    while (
      phrase.every(
        (character, characterIndex) =>
          characters[
            position +
              occurrenceCount * repeatedPhraseLength +
              characterIndex
          ] ===
          character
      )
    ) {
      occurrenceCount += 1;
    }
    result.push(...phrase, ...phrase);
    position += occurrenceCount * repeatedPhraseLength;
  }

  return result.join("");
};

export const cleanRepeatedSubtitleText = (text: string): string => {
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return text;

  let collapsedSentences = "";
  let previousSentence = "";
  let contentStart = 0;

  for (const match of text.matchAll(SENTENCE_END_PATTERN)) {
    const sentenceEnd = (match.index ?? 0) + match[0].length;
    const sentence = text.slice(contentStart, sentenceEnd);
    const comparableSentence = sentence
      .trim()
      .replace(TRAILING_SENTENCE_END_PATTERN, "")
      .trim()
      .replace(/\s+/gu, " ");

    if (!comparableSentence || comparableSentence !== previousSentence) {
      collapsedSentences += sentence;
    }
    previousSentence = comparableSentence;
    contentStart = sentenceEnd;
  }

  collapsedSentences += text.slice(contentStart);
  return collapseRepeatedFragments(collapsedSentences);
};

const getOutputLanguageSuffix = (targetLanguage: string): string => {
  const normalized = targetLanguage.trim().toLowerCase();
  if (!normalized || normalized === "zh" || normalized === "zh-cn") return "zh";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "zh";
};

export const buildSubtitleTranslationOutputPath = (
  subtitlePath: string,
  targetLanguage = "zh-CN"
): string => {
  const suffix = getOutputLanguageSuffix(targetLanguage);
  return subtitlePath.replace(/\.srt$/i, `.${suffix}.srt`);
};

const splitSrtBlocks = (content: string): string[] => content.split(/\n{2,}/);

const findSrtTimeLineIndex = (lines: string[]): number =>
  lines.findIndex((line) =>
    SRT_TIME_LINE_PATTERN.test(line.trim())
  );

const getSrtCueTimeLineIndex = (block: string): number => {
  const lines = block.split("\n");
  const timeLineIndex = findSrtTimeLineIndex(lines);
  return timeLineIndex === -1 || timeLineIndex === lines.length - 1
    ? -1
    : timeLineIndex;
};

type SrtCue = {
  blockIndex: number;
  cueIndex: number;
  headerLines: string[];
  text: string;
};

const getBatchMarker = (cueIndex: number): string =>
  `[[SUBTITLE_DUCK_CUE_${String(cueIndex).padStart(6, "0")}]]`;

const createTranslationBatches = (
  cues: SrtCue[],
  maxBatchCharacters: number
): SrtCue[][] => {
  const batches: SrtCue[][] = [];
  let currentBatch: SrtCue[] = [];
  let currentCharacterCount = 0;

  for (const cue of cues) {
    const cueCharacterCount = cue.text.length;
    if (
      currentBatch.length > 0 &&
      currentCharacterCount + cueCharacterCount > maxBatchCharacters
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentCharacterCount = 0;
    }

    currentBatch.push(cue);
    currentCharacterCount += cueCharacterCount;
  }

  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
};

const createBatchTranslationText = (batch: SrtCue[]): string =>
  batch
    .map((cue) => `${getBatchMarker(cue.cueIndex)}\n${cue.text}`)
    .join("\n");

const splitBatchTranslationText = (
  translatedText: string,
  batch: SrtCue[]
): Map<number, string> | null => {
  const translatedByCueIndex = new Map<number, string>();
  const markerPositions = batch.map((cue) => {
    const marker = getBatchMarker(cue.cueIndex);
    return {
      cueIndex: cue.cueIndex,
      marker,
      position: translatedText.indexOf(marker),
    };
  });

  if (markerPositions.some((entry) => entry.position === -1)) return null;
  for (let index = 1; index < markerPositions.length; index += 1) {
    if (markerPositions[index].position <= markerPositions[index - 1].position) {
      return null;
    }
  }

  markerPositions.forEach((entry, index) => {
    const contentStart = entry.position + entry.marker.length;
    const contentEnd =
      markerPositions[index + 1]?.position ?? translatedText.length;
    translatedByCueIndex.set(
      entry.cueIndex,
      translatedText.slice(contentStart, contentEnd).trim()
    );
  });

  return translatedByCueIndex;
};

const getProgressCueLabel = (batch: SrtCue[]): string => {
  const firstCueIndex = batch[0]?.cueIndex ?? 0;
  const lastCueIndex = batch.at(-1)?.cueIndex ?? firstCueIndex;
  return firstCueIndex === lastCueIndex
    ? `${firstCueIndex}`
    : `${firstCueIndex}-${lastCueIndex}`;
};

const normalizeSubtitleTextForComparison = (text: string): string =>
  text.replace(/[\s。！？!?，,；;.…]/gu, "");

export const translateSrtContent = async (
  content: string,
  {
    targetLanguage = "zh-CN",
    sourceLanguage = "auto",
    maxBatchCharacters = DEFAULT_SUBTITLE_TRANSLATION_BATCH_CHARACTERS,
    translateText,
    onProgress,
  }: TranslateSrtContentOptions
): Promise<string> => {
  const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const hasTrailingNewline = /\n$/.test(normalizedContent);
  const blocks = splitSrtBlocks(normalizedContent.trimEnd());
  const cues: SrtCue[] = [];
  let completedCueCount = 0;
  const translatedBlocks: string[] = [...blocks];

  blocks.forEach((block, blockIndex) => {
    const lines = block.split("\n");
    const timeLineIndex = getSrtCueTimeLineIndex(block);
    if (timeLineIndex === -1) return;

    cues.push({
      blockIndex,
      cueIndex: cues.length + 1,
      headerLines: lines.slice(0, timeLineIndex + 1),
      text: lines.slice(timeLineIndex + 1).join("\n"),
    });
  });

  const totalCueCount = cues.length;
  const batches = createTranslationBatches(
    cues,
    Math.max(1, maxBatchCharacters)
  );

  for (const batch of batches) {
    const cueLabel = getProgressCueLabel(batch);
    onProgress?.({
      phase: "translating",
      completedCueCount,
      totalCueCount,
      currentCueIndex: batch[0]?.cueIndex ?? null,
      message: `正在翻译第 ${cueLabel}/${totalCueCount} 条字幕`,
    });

    const translatedBatchText = await translateText({
      text: createBatchTranslationText(batch),
      sourceLanguage,
      targetLanguage,
    });

    const translatedByCueIndex =
      splitBatchTranslationText(translatedBatchText, batch) ??
      new Map(
        await Promise.all(
          batch.map(async (cue): Promise<[number, string]> => [
            cue.cueIndex,
            await translateText({
              text: cue.text,
              sourceLanguage,
              targetLanguage,
            }),
          ])
        )
      );

    for (const cue of batch) {
      translatedBlocks[cue.blockIndex] = [
        ...cue.headerLines,
        cleanRepeatedSubtitleText(
          translatedByCueIndex.get(cue.cueIndex) ?? cue.text
        ),
      ].join("\n");
    }

    completedCueCount += batch.length;
    onProgress?.({
      phase: "translated",
      completedCueCount,
      totalCueCount,
      currentCueIndex: batch.at(-1)?.cueIndex ?? null,
      message: `已翻译 ${completedCueCount}/${totalCueCount} 条字幕`,
    });
  }

  let previousNormalizedText = "";
  translatedBlocks.forEach((block, blockIndex) => {
    const lines = block.split("\n");
    const timeLineIndex = findSrtTimeLineIndex(lines);
    if (timeLineIndex === -1) return;

    const translatedText = lines.slice(timeLineIndex + 1).join("\n");
    const normalizedText = normalizeSubtitleTextForComparison(translatedText);

    if (normalizedText && normalizedText === previousNormalizedText) {
      translatedBlocks[blockIndex] = [
        ...lines.slice(0, timeLineIndex + 1),
        "",
      ].join("\n");
      return;
    }

    previousNormalizedText = normalizedText;
  });

  onProgress?.({
    phase: "completed",
    completedCueCount,
    totalCueCount,
    currentCueIndex: null,
    message: `字幕翻译完成，共 ${completedCueCount} 条`,
  });
  const translatedContent = translatedBlocks.join("\n\n");
  return hasTrailingNewline ? `${translatedContent}\n` : translatedContent;
};
