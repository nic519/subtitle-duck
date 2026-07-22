import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SubtitleGenerationSegment } from "../../subtitle-mux/subtitleGenerationSegments";
import { SubtitleGenerationSegmentEditor } from "./SubtitleGenerationSegmentEditor";

const renderEditor = (
  segments: SubtitleGenerationSegment[],
  activeSegmentId = segments[0]?.id ?? null
): string =>
  renderToStaticMarkup(
    <SubtitleGenerationSegmentEditor
      durationMs={60_000}
      playheadMs={20_000}
      isPlaying={false}
      segments={segments}
      activeSegmentId={activeSegmentId}
      disabled={false}
      error={null}
      onSelectSegment={() => undefined}
      onRemoveSegment={() => undefined}
      onSeek={() => undefined}
      onTogglePlayback={() => undefined}
      onSetStartFromPlayhead={() => undefined}
      onSetEndFromPlayhead={() => undefined}
    />
  );

describe("SubtitleGenerationSegmentEditor", () => {
  test("renders every range on the timeline and one active segment", () => {
    const html = renderEditor(
      [
        { id: "segment-1", startMs: 5_000, endMs: 15_000 },
        { id: "segment-2", startMs: 30_000, endMs: 45_000 },
      ],
      "segment-2"
    );

    expect(html.match(/data-subtitle-generation-segment=/g)).toHaveLength(2);
    expect(html).toContain('data-subtitle-generate-timeline="custom"');
    expect(html).not.toContain("添加片段");
    expect(html).toContain('aria-label="微退 0.1 秒"');
    expect(html).toContain('aria-label="快进 5 秒"');
    expect(html).toContain("设为开始");
    expect(html).toContain("设为结束");
    expect(html).not.toContain('type="checkbox"');
  });

  test("renders an unfinished marker without treating it as a valid range", () => {
    const html = renderEditor([{ id: "marker", startMs: 15_000, endMs: null }]);

    expect(html).toContain('data-subtitle-generation-marker="true"');
  });

  test("lists segments in source timeline order with delete actions", () => {
    const html = renderEditor([
      { id: "later", startMs: 30_000, endMs: 40_000 },
      { id: "earlier", startMs: 10_000, endMs: 20_000 },
    ]);

    expect(html.indexOf('data-subtitle-generation-segment="earlier"')).toBeLessThan(
      html.indexOf('data-subtitle-generation-segment="later"')
    );
    expect(html).toContain('aria-label="删除选中片段"');
  });

  test("shows the custom playback timeline", () => {
    const html = renderEditor([
      { id: "segment", startMs: 10_000, endMs: 25_000 },
    ]);

    expect(html).toContain('aria-label="字幕生成播放位置"');
    expect(html).toContain('aria-label="字幕生成时间线"');
  });
});
