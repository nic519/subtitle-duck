import { buildStreamingPreviewSeekUrl } from "./streamingVideoPreview";
import type { VideoPreviewSource } from "./videoPreviewSession";

export type VideoPreviewElement = {
  currentTime: number;
  paused: boolean;
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
  let detachStream: (() => void) | null = null;
  let snapshot = initialSnapshot();
  const listeners = new Set<(value: VideoPreviewPlaybackSnapshot) => void>();

  const publish = (next: VideoPreviewPlaybackSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
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
      stopStream();
      video = null;
    },
    seek(timeMs: number) {
      if (!video || !source) return;
      if (source.adapter === "ffmpeg-stream") {
        sourceOffsetMs = timeMs;
        autoplay = !video.paused;
        attachCurrentStream();
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
      publish({
        ...snapshot,
        playheadMs: sourceOffsetMs + Math.round(currentTimeSeconds * 1000),
      });
    },
    reportPlaying(isPlaying: boolean) {
      publish({ ...snapshot, isPlaying });
    },
    reportNativeError() {
      publish({ ...snapshot, isUnavailable: true });
    },
  };
};

export type VideoPreviewPlaybackSession = ReturnType<
  typeof createVideoPreviewPlaybackSession
>;
