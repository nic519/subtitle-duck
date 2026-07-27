import { describe, expect, test } from "bun:test";
import {
  addSubtitleGenerationMarker,
  createInitialSubtitleGenerationSegments,
  getValidSubtitleGenerationRanges,
  removeSubtitleGenerationSegment,
  updateSubtitleGenerationSegment,
  validateSubtitleGenerationSegments,
} from "./subtitleGenerationSegments";

describe("subtitle generation segments", () => {
  test("starts with one initial full-video segment", () => {
    expect(
      createInitialSubtitleGenerationSegments(60_000, "segment-1")
    ).toEqual([
      {
        id: "segment-1",
        startMs: 0,
        endMs: 60_000,
        initial: true,
      },
    ]);
  });

  test("first marker replaces the initial range and defaults to the video end", () => {
    const result = addSubtitleGenerationMarker(
      createInitialSubtitleGenerationSegments(60_000, "initial"),
      { id: "segment-2", startMs: 10_000, durationMs: 60_000 }
    );

    expect(result).toEqual({
      ok: true,
      segments: [{ id: "segment-2", startMs: 10_000, endMs: 60_000 }],
    });
  });

  test("adds markers in source timeline order", () => {
    const result = addSubtitleGenerationMarker(
      [{ id: "later", startMs: 30_000, endMs: 40_000 }],
      {
        id: "earlier",
        startMs: 10_000,
        durationMs: 60_000,
      }
    );

    expect(result).toEqual({
      ok: true,
      segments: [
        { id: "earlier", startMs: 10_000, endMs: null },
        { id: "later", startMs: 30_000, endMs: 40_000 },
      ],
    });
  });

  test("rejects a marker inside an existing segment", () => {
    expect(
      addSubtitleGenerationMarker(
        [{ id: "existing", startMs: 10_000, endMs: 20_000 }],
        {
          id: "marker",
          startMs: 15_000,
          durationMs: 60_000,
        }
      )
    ).toEqual({ ok: false, error: "字幕片段不能重叠" });
  });

  test("rejects overlapping ranges but accepts touching ranges", () => {
    const touching = [
      { id: "a", startMs: 10_000, endMs: 20_000 },
      { id: "b", startMs: 20_000, endMs: 30_000 },
    ];

    expect(validateSubtitleGenerationSegments(touching, 60_000)).toEqual({
      ok: true,
    });
    expect(
      validateSubtitleGenerationSegments(
        [...touching, { id: "c", startMs: 15_000, endMs: 25_000 }],
        60_000
      )
    ).toEqual({ ok: false, error: "字幕片段不能重叠" });
  });

  test("updates a marker into a valid segment", () => {
    const result = updateSubtitleGenerationSegment(
      [{ id: "marker", startMs: 10_000, endMs: null }],
      "marker",
      { endMs: 20_000 },
      60_000
    );

    expect(result).toEqual({
      ok: true,
      segments: [{ id: "marker", startMs: 10_000, endMs: 20_000 }],
    });
  });

  test("keeps existing segments when an update would overlap", () => {
    const segments = [
      { id: "a", startMs: 10_000, endMs: 20_000 },
      { id: "b", startMs: 30_000, endMs: 40_000 },
    ];

    expect(
      updateSubtitleGenerationSegment(
        segments,
        "b",
        { startMs: 15_000 },
        60_000
      )
    ).toEqual({
      ok: false,
      error: "字幕片段不能重叠",
    });
    expect(segments[1]?.startMs).toBe(30_000);
  });

  test("clamps edited boundaries to the video duration", () => {
    expect(
      updateSubtitleGenerationSegment(
        [{ id: "a", startMs: 10_000, endMs: 20_000 }],
        "a",
        { startMs: -1_000, endMs: 70_000 },
        60_000
      )
    ).toEqual({
      ok: true,
      segments: [{ id: "a", startMs: 0, endMs: 60_000 }],
    });
  });

  test("returns only complete valid ranges for generation", () => {
    expect(
      getValidSubtitleGenerationRanges([
        { id: "valid", startMs: 10_000, endMs: 20_000 },
        { id: "marker", startMs: 30_000, endMs: null },
      ])
    ).toEqual([{ startMs: 10_000, endMs: 20_000 }]);
  });

  test("removes a segment without inventing a replacement", () => {
    expect(
      removeSubtitleGenerationSegment(
        [
          { id: "a", startMs: 10_000, endMs: 20_000 },
          { id: "b", startMs: 30_000, endMs: 40_000 },
        ],
        "a"
      )
    ).toEqual([{ id: "b", startMs: 30_000, endMs: 40_000 }]);
  });
});
