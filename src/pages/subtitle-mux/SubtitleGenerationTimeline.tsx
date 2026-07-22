import { Trash2 } from "lucide-react";
import type { SubtitleGenerationSegment } from "../../subtitle-mux/subtitleGenerationSegments";
import { formatSubtitleRangeTime } from "../../subtitle-mux/subtitleGenerationRange";

const segmentColors = ["#6382a4", "#7c6a9f", "#a3687d", "#5e8d91"];

type SubtitleGenerationTimelineProps = {
  durationMs: number;
  playheadMs: number;
  segments: SubtitleGenerationSegment[];
  activeSegmentId: string | null;
  disabled: boolean;
  onSelectSegment: (segmentId: string) => void;
  onRemoveSegment: (segmentId: string) => void;
  onSeek: (timeMs: number) => void;
  onTogglePlayback: () => void;
};

export const SubtitleGenerationTimeline = ({
  durationMs,
  playheadMs,
  segments,
  activeSegmentId,
  disabled,
  onSelectSegment,
  onRemoveSegment,
  onSeek,
  onTogglePlayback,
}: SubtitleGenerationTimelineProps) => {
  const safeDurationMs = Math.max(0, durationMs);
  const sortedSegments = [...segments].sort(
    (left, right) => left.startMs - right.startMs,
  );
  const getPercent = (timeMs: number): number =>
    safeDurationMs > 0
      ? Math.min(100, Math.max(0, (timeMs / safeDurationMs) * 100))
      : 0;
  const seekBy = (offsetMs: number) =>
    onSeek(Math.min(safeDurationMs, Math.max(0, playheadMs + offsetMs)));
  const controlDisabled = disabled || safeDurationMs <= 0;
  const activeSegment = sortedSegments.find(
    (segment) => segment.id === activeSegmentId && !segment.initial,
  );
  const activeSegmentDeletePosition = activeSegment
    ? Math.min(
        94,
        Math.max(
          6,
          getPercent(
            activeSegment.endMs === null
              ? activeSegment.startMs
              : activeSegment.endMs,
          ),
        ),
      )
    : null;

  return (
    <div
      data-subtitle-generate-timeline="custom"
      data-subtitle-generate-range-slider="true"
      tabIndex={0}
      onKeyDown={(event) => {
        if (controlDisabled || event.target !== event.currentTarget) return;
        const offset = event.shiftKey ? 5_000 : 100;
        if (event.key === " ") {
          event.preventDefault();
          onTogglePlayback();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          seekBy(-offset);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          seekBy(offset);
        }
      }}
      aria-label="字幕生成时间线"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-accent)]"
    >
      <div className="relative h-[34px] overflow-hidden rounded-[5px] border border-white/10 bg-black/35">
        <div className="absolute inset-y-1 inset-x-0">
          {sortedSegments.map((segment, index) => {
            const color = segmentColors[index % segmentColors.length];
            const start = getPercent(segment.startMs);
            const end = getPercent(segment.endMs ?? segment.startMs);
            const style = {
              left: `${start}%`,
              width: `${Math.max(0, end - start)}%`,
              backgroundColor: color,
            };

            if (segment.endMs === null) {
              return (
                <button
                  key={segment.id}
                  data-subtitle-generation-marker="true"
                  type="button"
                  aria-label={`选择片段 ${index + 1}`}
                  onClick={() => onSelectSegment(segment.id)}
                  disabled={disabled}
                  className="absolute inset-y-0 z-20 w-4 -translate-x-1/2"
                  style={{ left: `${start}%` }}
                >
                  <span
                    className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current"
                    style={{ color }}
                  />
                </button>
              );
            }

            if (segment.initial) {
              return (
                <div
                  key={segment.id}
                  data-subtitle-generation-segment={segment.id}
                  className="pointer-events-none absolute inset-y-0 rounded-[3px] opacity-75"
                  style={style}
                />
              );
            }

            return (
              <button
                key={segment.id}
                data-subtitle-generation-segment={segment.id}
                type="button"
                aria-label={`选择片段 ${index + 1}`}
                onClick={() => onSelectSegment(segment.id)}
                disabled={disabled}
                className={`absolute inset-y-0 z-20 rounded-[3px] transition-opacity ${
                  segment.id === activeSegmentId
                    ? "opacity-100 ring-1 ring-white/90"
                    : "opacity-75 hover:opacity-100"
                }`}
                style={style}
              />
            );
          })}
        </div>
        <input
          aria-label="字幕生成播放位置"
          type="range"
          min={0}
          max={safeDurationMs}
          step={100}
          value={Math.min(safeDurationMs, Math.max(0, playheadMs))}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={controlDisabled}
          className="subtitle-range-slider absolute inset-x-0 top-0 z-10 h-[34px] appearance-none bg-transparent disabled:opacity-40"
        />
        {activeSegment && activeSegmentDeletePosition !== null ? (
          <button
            type="button"
            onClick={() => onRemoveSegment(activeSegment.id)}
            disabled={disabled}
            aria-label="删除选中片段"
            title="删除选中片段"
            className="absolute top-1/2 z-30 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/65 text-white/80 shadow-sm transition-colors hover:bg-black/85 hover:text-white disabled:pointer-events-none disabled:opacity-35"
            style={{ left: `${activeSegmentDeletePosition}%` }}
          >
            <Trash2 className="size-3" />
          </button>
        ) : null}
      </div>
      <div className="min-w-[86px] text-right font-mono text-[length:var(--font-size-caption)] text-foreground">
        {formatSubtitleRangeTime(playheadMs)}
      </div>
    </div>
  );
};
