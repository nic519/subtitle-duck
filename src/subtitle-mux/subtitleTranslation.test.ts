import { describe, expect, test } from "bun:test";
import {
  buildSubtitleTranslationOutputPath,
  cleanRepeatedSubtitleText,
  translateSrtContent,
} from "./subtitleTranslation";

describe("subtitleTranslation", () => {
  test("reduces a phrase repeated at least three times to two occurrences", () => {
    expect(cleanRepeatedSubtitleText("真的真的真的真的")).toBe("真的真的");
  });

  test("keeps a phrase repeated exactly twice", () => {
    expect(cleanRepeatedSubtitleText("不要不要")).toBe("不要不要");
  });

  test("collapses adjacent duplicate complete sentences", () => {
    expect(cleanRepeatedSubtitleText("我知道了。我知道了。我知道了。")).toBe(
      "我知道了。"
    );
    expect(cleanRepeatedSubtitleText("Hello. Hello!")).toBe("Hello.");
    expect(cleanRepeatedSubtitleText("Hello\nworld. Hello world!")).toBe(
      "Hello\nworld."
    );
  });

  test("reduces an arbitrarily long phrase repeated three times", () => {
    const phrase = Array.from({ length: 65 }, (_, index) =>
      String.fromCodePoint(0x4e00 + index)
    ).join("");

    expect(cleanRepeatedSubtitleText(phrase.repeat(3))).toBe(phrase.repeat(2));
  });

  test("keeps non-adjacent duplicate complete sentences", () => {
    expect(
      cleanRepeatedSubtitleText("我知道了。然后继续。我知道了。")
    ).toBe("我知道了。然后继续。我知道了。");
  });

  test("keeps empty, punctuation-only, and ordinary text unchanged", () => {
    expect(cleanRepeatedSubtitleText("")).toBe("");
    expect(cleanRepeatedSubtitleText("……")).toBe("……");
    expect(cleanRepeatedSubtitleText("今天一起回家吧。")).toBe(
      "今天一起回家吧。"
    );
  });

  test(
    "bounds repeated-fragment scanning for long non-repeating subtitle text",
    () => {
      const text = Array.from({ length: 20_000 }, (_, index) =>
        String.fromCodePoint(0x4e00 + index)
      ).join("");

      expect(cleanRepeatedSubtitleText(text)).toBe(text);
    },
    250
  );

  test("translates only SRT cue text while preserving numbers and timing", async () => {
    const calls: Array<{ text: string; targetLanguage: string }> = [];
    const result = await translateSrtContent(
      [
        "1",
        "00:00:01,000 --> 00:00:03,000",
        "Hello there.",
        "How are you?",
        "",
        "2",
        "00:00:04,000 --> 00:00:05,500",
        "<i>Good morning.</i>",
        "",
      ].join("\n"),
      {
        translateText: async ({ text, targetLanguage }) => {
          calls.push({ text, targetLanguage });
          return text
            .replace("Hello there.\nHow are you?", "你好。\n你好吗？")
            .replace("<i>Good morning.</i>", "<i>早上好。</i>");
        },
      }
    );

    expect(calls).toEqual([
      {
        text: [
          "[[SUBTITLE_DUCK_CUE_000001]]",
          "Hello there.",
          "How are you?",
          "[[SUBTITLE_DUCK_CUE_000002]]",
          "<i>Good morning.</i>",
        ].join("\n"),
        targetLanguage: "zh-CN",
      },
    ]);
    expect(result).toBe(
      [
        "1",
        "00:00:01,000 --> 00:00:03,000",
        "你好。",
        "你好吗？",
        "",
        "2",
        "00:00:04,000 --> 00:00:05,500",
        "<i>早上好。</i>",
        "",
      ].join("\n")
    );
  });

  test("cleans translated cues and empties only adjacent duplicates without removing blocks", async () => {
    const source = [
      "1",
      "00:00:01,000 --> 00:00:03,000",
      "First.",
      "",
      "2",
      "00:00:04,000 --> 00:00:05,500",
      "Second.",
      "",
      "3",
      "00:00:06,000 --> 00:00:07,500",
      "Third.",
      "",
    ].join("\n");

    const result = await translateSrtContent(source, {
      translateText: async ({ text }) =>
        text
          .replace("First.", "我知道了。我知道了。我知道了。")
          .replace("Second.", "我知道了。")
          .replace("Third.", "不要不要"),
    });

    expect(result).toBe(
      [
        "1",
        "00:00:01,000 --> 00:00:03,000",
        "我知道了。",
        "",
        "2",
        "00:00:04,000 --> 00:00:05,500",
        "",
        "",
        "3",
        "00:00:06,000 --> 00:00:07,500",
        "不要不要",
        "",
      ].join("\n")
    );
    expect(result.split(/\n{2,}/)).toHaveLength(3);
    expect(result.endsWith("\n")).toBe(true);
  });

  test("compares only adjacent cues while ignoring whitespace and common punctuation", async () => {
    const result = await translateSrtContent(
      [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "First.",
        "",
        "2",
        "00:00:03,000 --> 00:00:04,000",
        "Second.",
        "",
        "3",
        "00:00:05,000 --> 00:00:06,000",
        "Third.",
        "",
        "4",
        "00:00:07,000 --> 00:00:08,000",
        "Fourth.",
        "",
      ].join("\n"),
      {
        translateText: async ({ text }) =>
          text
            .replace("First.", "你好，世界！")
            .replace("Second.", "你 好\n世 界。")
            .replace("Third.", "中间字幕")
            .replace("Fourth.", "你好世界"),
      }
    );

    expect(result).toContain(
      ["2", "00:00:03,000 --> 00:00:04,000", "", ""].join("\n")
    );
    expect(result).toContain(
      ["4", "00:00:07,000 --> 00:00:08,000", "你好世界"].join("\n")
    );
  });

  test("clears every duplicate in an uninterrupted adjacent chain", async () => {
    const translateCues = async (translations: string[]) =>
      translateSrtContent(
        translations
          .flatMap((_, index) => [
            `${index + 1}`,
            `00:00:0${index + 1},000 --> 00:00:0${index + 2},000`,
            `Source ${index + 1}`,
            "",
          ])
          .join("\n"),
        {
          translateText: async ({ text }) =>
            translations.reduce(
              (translated, translation, index) =>
                translated.replace(`Source ${index + 1}`, translation),
              text
            ),
        }
      );

    const uninterrupted = await translateCues(["A", "A", "A"]);
    expect(uninterrupted).toBe(
      [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "A",
        "",
        "2",
        "00:00:02,000 --> 00:00:03,000",
        "",
        "",
        "3",
        "00:00:03,000 --> 00:00:04,000",
        "",
        "",
      ].join("\n")
    );

    const broken = await translateCues(["A", "A", "B", "A"]);
    expect(broken).toBe(
      [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "A",
        "",
        "2",
        "00:00:02,000 --> 00:00:03,000",
        "",
        "",
        "3",
        "00:00:03,000 --> 00:00:04,000",
        "B",
        "",
        "4",
        "00:00:04,000 --> 00:00:05,000",
        "A",
        "",
      ].join("\n")
    );
  });

  test("keeps duplicate text when an original empty cue breaks adjacency", async () => {
    const calls: string[] = [];
    const result = await translateSrtContent(
      [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "First.",
        "",
        "2",
        "00:00:03,000 --> 00:00:04,000",
        "",
        "3",
        "00:00:05,000 --> 00:00:06,000",
        "Third.",
        "",
      ].join("\n"),
      {
        translateText: async ({ text }) => {
          calls.push(text);
          return text.replace("First.", "A").replace("Third.", "A");
        },
      }
    );

    expect(calls).toEqual([
      [
        "[[SUBTITLE_DUCK_CUE_000001]]",
        "First.",
        "[[SUBTITLE_DUCK_CUE_000002]]",
        "Third.",
      ].join("\n"),
    ]);
    expect(result).toBe(
      [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "A",
        "",
        "2",
        "00:00:03,000 --> 00:00:04,000",
        "",
        "3",
        "00:00:05,000 --> 00:00:06,000",
        "A",
        "",
      ].join("\n")
    );
  });

  test("preserves semantic punctuation when comparing adjacent cues", async () => {
    const result = await translateSrtContent(
      [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "First.",
        "",
        "2",
        "00:00:03,000 --> 00:00:04,000",
        "Second.",
        "",
        "3",
        "00:00:05,000 --> 00:00:06,000",
        "Third.",
        "",
        "4",
        "00:00:07,000 --> 00:00:08,000",
        "Fourth.",
        "",
      ].join("\n"),
      {
        translateText: async ({ text }) =>
          text
            .replace("First.", "10-20")
            .replace("Second.", "1020")
            .replace("Third.", "A/B")
            .replace("Fourth.", "AB"),
      }
    );

    expect(result).toContain(
      ["1", "00:00:01,000 --> 00:00:02,000", "10-20"].join("\n")
    );
    expect(result).toContain(
      ["2", "00:00:03,000 --> 00:00:04,000", "1020"].join("\n")
    );
    expect(result).toContain(
      ["3", "00:00:05,000 --> 00:00:06,000", "A/B"].join("\n")
    );
    expect(result).toContain(
      ["4", "00:00:07,000 --> 00:00:08,000", "AB"].join("\n")
    );
  });

  test("batches cue text up to a character limit to reduce translation requests", async () => {
    const calls: string[] = [];
    const result = await translateSrtContent(
      [
        "1",
        "00:00:01,000 --> 00:00:03,000",
        "Hello.",
        "",
        "2",
        "00:00:04,000 --> 00:00:05,500",
        "Good morning.",
        "",
        "3",
        "00:00:06,000 --> 00:00:07,500",
        "Thanks.",
        "",
      ].join("\n"),
      {
        maxBatchCharacters: 1000,
        translateText: async ({ text }) => {
          calls.push(text);
          return text
            .replace("Hello.", "你好。")
            .replace("Good morning.", "早上好。")
            .replace("Thanks.", "谢谢。");
        },
      }
    );

    expect(calls).toHaveLength(1);
    expect(result).toContain("你好。");
    expect(result).toContain("早上好。");
    expect(result).toContain("谢谢。");
  });

  test("splits subtitle translation batches when the character limit is reached", async () => {
    const calls: string[] = [];
    await translateSrtContent(
      [
        "1",
        "00:00:01,000 --> 00:00:03,000",
        "12345",
        "",
        "2",
        "00:00:04,000 --> 00:00:05,500",
        "67890",
        "",
        "3",
        "00:00:06,000 --> 00:00:07,500",
        "abcde",
        "",
      ].join("\n"),
      {
        maxBatchCharacters: 9,
        translateText: async ({ text }) => {
          calls.push(text);
          return text;
        },
      }
    );

    expect(calls).toHaveLength(3);
  });

  test("derives a Chinese subtitle output path next to the source file", () => {
    expect(
      buildSubtitleTranslationOutputPath("/Volumes/JAV/ABP-123.en.srt", "zh-CN")
    ).toBe("/Volumes/JAV/ABP-123.en.zh.srt");
  });

  test("reports batch translation progress", async () => {
    const progressEvents: Array<{
      phase: string;
      completedCueCount: number;
      totalCueCount: number;
      currentCueIndex: number | null;
    }> = [];

    await translateSrtContent(
      [
        "1",
        "00:00:01,000 --> 00:00:03,000",
        "Hello.",
        "",
        "2",
        "00:00:04,000 --> 00:00:05,500",
        "Good morning.",
        "",
      ].join("\n"),
      {
        translateText: async ({ text }) => `zh:${text}`,
        onProgress: (progress) => {
          progressEvents.push({
            phase: progress.phase,
            completedCueCount: progress.completedCueCount,
            totalCueCount: progress.totalCueCount,
            currentCueIndex: progress.currentCueIndex,
          });
        },
      }
    );

    expect(progressEvents).toEqual([
      {
        phase: "translating",
        completedCueCount: 0,
        totalCueCount: 2,
        currentCueIndex: 1,
      },
      {
        phase: "translated",
        completedCueCount: 2,
        totalCueCount: 2,
        currentCueIndex: 2,
      },
      {
        phase: "completed",
        completedCueCount: 2,
        totalCueCount: 2,
        currentCueIndex: null,
      },
    ]);
  });

  test("stops before starting another subtitle batch", async () => {
    const controller = new AbortController();
    let callCount = 0;

    await expect(
      translateSrtContent(
        [
          "1",
          "00:00:01,000 --> 00:00:03,000",
          "12345",
          "",
          "2",
          "00:00:04,000 --> 00:00:05,500",
          "67890",
        ].join("\n"),
        {
          maxBatchCharacters: 9,
          abortSignal: controller.signal,
          translateText: async ({ text }) => {
            callCount += 1;
            controller.abort();
            return text;
          },
        },
      ),
    ).rejects.toHaveProperty("name", "AbortError");

    expect(callCount).toBe(1);
  });
});
