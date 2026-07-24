export type VideoPreviewSource = {
  adapter: "native" | "ffmpeg-stream";
  url: string;
};

export type VideoPreviewSnapshot = {
  status: "idle" | "loading" | "ready" | "error";
  videoPath: string | null;
  durationMs: number | null;
  source: VideoPreviewSource | null;
  error: string | null;
};

type VideoPreviewAdapter = {
  probeDuration: (videoPath: string) => Promise<number>;
  getNativeSource: (videoPath: string) => Promise<string>;
  getStreamSource: (videoPath: string) => Promise<string>;
};

const idleSnapshot = (): VideoPreviewSnapshot => ({
  status: "idle",
  videoPath: null,
  durationMs: null,
  source: null,
  error: null,
});

export const createVideoPreviewSession = (adapter: VideoPreviewAdapter) => {
  let snapshot = idleSnapshot();
  let loadIdentity: object | null = null;
  const listeners = new Set<(value: VideoPreviewSnapshot) => void>();

  const publish = (next: VideoPreviewSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: (value: VideoPreviewSnapshot) => void) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    async load(videoPath: string) {
      const normalizedPath = videoPath.trim();
      if (!normalizedPath) return snapshot;
      const identity = {};
      loadIdentity = identity;
      publish({
        status: "loading",
        videoPath: normalizedPath,
        durationMs: null,
        source: null,
        error: null,
      });
      try {
        const [durationMs, nativeUrl] = await Promise.all([
          adapter.probeDuration(normalizedPath),
          adapter.getNativeSource(normalizedPath),
        ]);
        if (loadIdentity !== identity) return snapshot;
        publish({
          status: "ready",
          videoPath: normalizedPath,
          durationMs,
          source: { adapter: "native", url: nativeUrl },
          error: null,
        });
        try {
          const streamUrl = await adapter.getStreamSource(normalizedPath);
          if (loadIdentity !== identity) return snapshot;
          publish({
            ...snapshot,
            source: { adapter: "ffmpeg-stream", url: streamUrl },
          });
        } catch (error) {
          if (loadIdentity !== identity) return snapshot;
          publish({
            ...snapshot,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return snapshot;
      } catch (error) {
        if (loadIdentity !== identity) return snapshot;
        publish({
          status: "error",
          videoPath: normalizedPath,
          durationMs: null,
          source: null,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    clear() {
      loadIdentity = null;
      publish(idleSnapshot());
    },
  };
};

export type VideoPreviewSession = ReturnType<typeof createVideoPreviewSession>;
