export const buildStreamingPreviewSeekUrl = (
  previewUrl: string,
  startMs: number,
): string => {
  const url = new URL(previewUrl);
  url.searchParams.set("startMs", String(Math.max(0, Math.round(startMs))));
  return url.toString();
};

const streamingPreviewMimeType =
  'video/mp4; codecs="avc1.42C01E, mp4a.40.2"';

export const attachStreamingVideoPreview = (
  video: HTMLVideoElement,
  previewUrl: string,
  options: {
    autoplay?: boolean;
    onError?: (error: unknown) => void;
  } = {},
): (() => void) => {
  const abortController = new AbortController();
  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  let disposed = false;

  const reportError = (error: unknown) => {
    if (!disposed && !abortController.signal.aborted) options.onError?.(error);
  };

  const appendChunk = (
    sourceBuffer: SourceBuffer,
    chunk: Uint8Array,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const onUpdateEnd = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("实时兼容预览缓冲失败"));
      };
      const cleanup = () => {
        sourceBuffer.removeEventListener("updateend", onUpdateEnd);
        sourceBuffer.removeEventListener("error", onError);
      };
      sourceBuffer.addEventListener("updateend", onUpdateEnd);
      sourceBuffer.addEventListener("error", onError);
      const bytes = new Uint8Array(chunk.byteLength);
      bytes.set(chunk);
      sourceBuffer.appendBuffer(bytes);
    });

  const onSourceOpen = async () => {
    try {
      const sourceBuffer = mediaSource.addSourceBuffer(streamingPreviewMimeType);
      const response = await fetch(previewUrl, {
        cache: "no-store",
        signal: abortController.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`实时兼容预览请求失败: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      let startedPlayback = false;
      while (!disposed) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;
        await appendChunk(sourceBuffer, value);
        if (!startedPlayback && options.autoplay) {
          startedPlayback = true;
          void video.play().catch(() => undefined);
        }
      }
      if (!disposed && mediaSource.readyState === "open") {
        mediaSource.endOfStream();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        reportError(error);
      }
    }
  };

  mediaSource.addEventListener("sourceopen", onSourceOpen, { once: true });
  video.src = objectUrl;
  video.load();

  return () => {
    disposed = true;
    abortController.abort();
    mediaSource.removeEventListener("sourceopen", onSourceOpen);
    URL.revokeObjectURL(objectUrl);
  };
};
