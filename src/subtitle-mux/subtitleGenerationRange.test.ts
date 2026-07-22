import { describe, expect, test } from "bun:test";
import {
  createDefaultSubtitleGenerationRange,
  formatSubtitleRangeTime,
  isSubtitleGenerationRangeValid,
} from "./subtitleGenerationRange";

describe("subtitleGenerationRange", () => {
  test("formats milliseconds as subtitle range time", () => {
    expect(formatSubtitleRangeTime(754500)).toBe("00:12:34.500");
    expect(formatSubtitleRangeTime(754500, ",")).toBe("00:12:34,500");
  });

  test("creates a default range from zero to the probed duration", () => {
    expect(createDefaultSubtitleGenerationRange(850000)).toEqual({
      startMs: 0,
      endMs: 850000,
    });
  });

  test("validates the range against the probed duration", () => {
    expect(
      isSubtitleGenerationRangeValid({
        startMs: 754500,
        endMs: 850000,
        durationMs: 850000,
      })
    ).toBe(true);
    expect(
      isSubtitleGenerationRangeValid({
        startMs: 850000,
        endMs: 754500,
        durationMs: 850000,
      })
    ).toBe(false);
  });
});
