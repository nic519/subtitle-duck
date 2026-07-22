import { StatusMessage } from "../../components/page-ui";
import type { SubtitleGenerationSegment } from "../../subtitle-mux/subtitleGenerationSegments";
import { SubtitleGenerationSegmentActions } from "./SubtitleGenerationSegmentActions";
import { SubtitleGenerationTimeline } from "./SubtitleGenerationTimeline";

export type SubtitleGenerationSegmentEditorProps = {
  durationMs: number;
  playheadMs: number;
  isPlaying: boolean;
  segments: SubtitleGenerationSegment[];
  activeSegmentId: string | null;
  disabled: boolean;
  error: string | null;
  onSelectSegment: (segmentId: string) => void;
  onRemoveSegment: (segmentId: string) => void;
  onSeek: (timeMs: number) => void;
  onTogglePlayback: () => void;
  onSetStartFromPlayhead: () => void;
  onSetEndFromPlayhead: () => void;
};

export const SubtitleGenerationSegmentEditor = ({
  durationMs,
  playheadMs,
  isPlaying,
  segments,
  activeSegmentId,
  disabled,
  error,
  onSelectSegment,
  onRemoveSegment,
  onSeek,
  onTogglePlayback,
  onSetStartFromPlayhead,
  onSetEndFromPlayhead,
}: SubtitleGenerationSegmentEditorProps) => (
  <div
    data-subtitle-generate-range="true"
    data-subtitle-generation-segment-editor="true"
    className="subtitle-accent-line grid gap-3 border-t pt-3"
  >
    <SubtitleGenerationTimeline
      durationMs={durationMs}
      playheadMs={playheadMs}
      segments={segments}
      activeSegmentId={activeSegmentId}
      disabled={disabled}
      onSelectSegment={onSelectSegment}
      onRemoveSegment={onRemoveSegment}
      onSeek={onSeek}
      onTogglePlayback={onTogglePlayback}
    />
    <SubtitleGenerationSegmentActions
      disabled={disabled}
      canSetStart={durationMs > 0}
      canSetEnd={activeSegmentId !== null}
      durationMs={durationMs}
      playheadMs={playheadMs}
      isPlaying={isPlaying}
      onSeek={onSeek}
      onTogglePlayback={onTogglePlayback}
      onSetStart={onSetStartFromPlayhead}
      onSetEnd={onSetEndFromPlayhead}
    />
    {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
  </div>
);
