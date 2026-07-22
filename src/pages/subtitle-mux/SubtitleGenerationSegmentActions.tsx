import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";

type SubtitleGenerationSegmentActionsProps = {
  disabled: boolean;
  canSetStart: boolean;
  canSetEnd: boolean;
  durationMs: number;
  playheadMs: number;
  isPlaying: boolean;
  onSeek: (timeMs: number) => void;
  onTogglePlayback: () => void;
  onSetStart: () => void;
  onSetEnd: () => void;
};

export const SubtitleGenerationSegmentActions = ({
  disabled,
  canSetStart,
  canSetEnd,
  durationMs,
  playheadMs,
  isPlaying,
  onSeek,
  onTogglePlayback,
  onSetStart,
  onSetEnd,
}: SubtitleGenerationSegmentActionsProps) => {
  const canNavigate = !disabled && durationMs > 0;
  const seekBy = (offsetMs: number) =>
    onSeek(Math.min(durationMs, Math.max(0, playheadMs + offsetMs)));
  const iconButtonClassName =
    "grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.09] hover:text-foreground disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="-mt-1 flex w-full flex-wrap items-center justify-center gap-3">
      <div
        data-subtitle-generation-jog-controls="true"
        className="flex items-center rounded-full border border-white/10 bg-black/[0.16] p-0.5"
      >
        <button
          type="button"
          onClick={() => seekBy(-5_000)}
          disabled={!canNavigate}
          aria-label="快退 5 秒"
          title="快退 5 秒（Shift + ←）"
          className={iconButtonClassName}
        >
          <SkipBack className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => seekBy(-100)}
          disabled={!canNavigate}
          aria-label="微退 0.1 秒"
          title="微退 0.1 秒（←）"
          className={iconButtonClassName}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onTogglePlayback}
          disabled={!canNavigate}
          aria-label={isPlaying ? "暂停预览" : "播放预览"}
          title={isPlaying ? "暂停（Space）" : "播放（Space）"}
          className="grid size-7 place-items-center rounded-full bg-white/[0.1] text-foreground transition-colors hover:bg-white/[0.16] disabled:pointer-events-none disabled:opacity-35"
        >
          {isPlaying ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => seekBy(100)}
          disabled={!canNavigate}
          aria-label="微进 0.1 秒"
          title="微进 0.1 秒（→）"
          className={iconButtonClassName}
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => seekBy(5_000)}
          disabled={!canNavigate}
          aria-label="快进 5 秒"
          title="快进 5 秒（Shift + →）"
          className={iconButtonClassName}
        >
          <SkipForward className="size-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/[0.16] p-0.5">
        <button
          type="button"
          onClick={onSetStart}
          disabled={disabled || !canSetStart}
          className="rounded-full border border-[var(--subtitle-accent-border)] bg-[var(--subtitle-accent-soft)] px-3 py-1.5 text-[length:var(--font-size-caption)] font-medium text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)] transition-colors hover:bg-[var(--subtitle-accent-border)] disabled:pointer-events-none disabled:opacity-35"
        >
          设为开始
        </button>
        <button
          type="button"
          onClick={onSetEnd}
          disabled={disabled || !canSetEnd}
          className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[length:var(--font-size-caption)] font-medium text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)] transition-colors hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-35"
        >
          设为结束
        </button>
      </div>
    </div>
  );
};
