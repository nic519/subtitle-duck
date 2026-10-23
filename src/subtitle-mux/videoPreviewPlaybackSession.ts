import { buildStreamingPreviewSeekUrl } from "./streamingVideoPreview";
import type { VideoPreviewSource } from "./videoPreviewSession";

export type VideoPreviewElement = {
  currentTime: number;
  paused: boolean;
  buffered?: Pick<TimeRanges, "length" | "start" | "end">;
  play: () => Promise<unknown>;
  pause: () => void;
};

type PlaybackAdapter = {
  attachStream: (
    video: VideoPreviewElement,
    url: string,
    options: { autoplay: boolean; onError: (error: unknown) => void },
  ) => () => void;
};

export type VideoPreviewPlaybackSnapshot = {
  sourceUrl: string | undefined;
  playheadMs: number;
  isPlaying: boolean;
  isUnavailable: boolean;
  error: string | null;
};

const initialSnapshot = (): VideoPreviewPlaybackSnapshot => ({
  sourceUrl: undefined,
  playheadMs: 0,
  isPlaying: false,
  isUnavailable: false,
  error: null,
});

export const createVideoPreviewPlaybackSession = (
  adapter: PlaybackAdapter,
) => {
  let source: VideoPreviewSource | null = null;
  let video: VideoPreviewElement | null = null;
  let sourceOffsetMs = 0;
  let autoplay = false;
  let seekTimer: ReturnType<typeof setTimeout> | null = null;
  let detachStream: (() => void) | null = null;
  let snapshot = initialSnapshot();
  const listeners = new Set<(value: VideoPreviewPlaybackSnapshot) => void>();

  const publish = (next: VideoPreviewPlaybackSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  };

  const cancelPendingSeek = () => {
    if (seekTimer !== null) clearTimeout(seekTimer);
    seekTimer = null;
  };

  const stopStream = () => {
    detachStream?.();
    detachStream = null;
  };

  const attachCurrentStream = () => {
    stopStream();
    if (!video || source?.adapter !== "ffmpeg-stream") return;
    detachStream = adapter.attachStream(
      video,
      buildStreamingPreviewSeekUrl(source.url, sourceOffsetMs),
      {
        autoplay,
        onError: (error) => {
          publish({
            ...snapshot,
            isUnavailable: true,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      },
    );
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: (value: VideoPreviewPlaybackSnapshot) => void) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    setSource(nextSource: VideoPreviewSource | null) {
      cancelPendingSeek();
      source = nextSource;
      sourceOffsetMs = 0;
      autoplay = false;
      publish({
        ...initialSnapshot(),
        sourceUrl: nextSource?.adapter === "native" ? nextSource.url : undefined,
      });
      attachCurrentStream();
    },
    attach(nextVideo: VideoPreviewElement) {
      video = nextVideo;
      attachCurrentStream();
    },
    detach() {
      cancelPendingSeek();
      stopStream();
      video = null;
    },
    seek(timeMs: number) {
      if (!video || !source) return;
      if (source.adapter === "ffmpeg-stream") {
        cancelPendingSeek();
        const relativeSeconds = (timeMs - sourceOffsetMs) / 1000;
        const buffered = video.buffered;
        let canSeekInBuffer = false;
        for (let index = 0; buffered && index < buffered.length; index++) {
          if (
            relativeSeconds >= buffered.start(index) &&
            relativeSeconds < buffered.end(index)
          ) {
            canSeekInBuffer = true;
            break;
          }
        }
        if (canSeekInBuffer) {
          video.currentTime = relativeSeconds;
        } else {
          // Update the playhead immediately, but only restart after scrubbing settles.
          seekTimer = setTimeout(() => {
            seekTimer = null;
            autoplay = video !== null && !video.paused;
            sourceOffsetMs = timeMs;
            attachCurrentStream();
          }, 120);
        }
      } else {
        video.currentTime = timeMs / 1000;
      }
      publish({ ...snapshot, playheadMs: timeMs });
    },
    toggle() {
      if (!video) return;
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
    },
    reportTime(currentTimeSeconds: number) {
      if (seekTimer !== null) return;
      publish({
        ...snapshot,
        playheadMs: sourceOffsetMs + Math.round(currentTimeSeconds * 1000),
      });
    },
    reportPlaying(isPlaying: boolean) {
      publish({ ...snapshot, isPlaying });
    },
    reportNativeError() {
      const failedSource = source;
      if (failedSource?.adapter === "native" && failedSource.requestFallback) {
        void failedSource.requestFallback().catch((error) => {
          if (source !== failedSource) return;
          publish({
            ...snapshot,
            isUnavailable: true,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        return;
      }
      publish({ ...snapshot, isUnavailable: true });
    },
  };
};

export type VideoPreviewPlaybackSession = ReturnType<
  typeof createVideoPreviewPlaybackSession
>;
