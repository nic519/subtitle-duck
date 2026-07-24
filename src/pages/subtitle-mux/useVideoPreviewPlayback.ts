import { useEffect, useRef, useState } from "react";
import { attachStreamingVideoPreview } from "../../subtitle-mux/streamingVideoPreview";
import {
  createVideoPreviewPlaybackSession,
  type VideoPreviewElement,
} from "../../subtitle-mux/videoPreviewPlaybackSession";
import type { VideoPreviewSource } from "../../subtitle-mux/videoPreviewSession";

export const useVideoPreviewPlayback = (
  source: VideoPreviewSource | null,
) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<
    ReturnType<typeof createVideoPreviewPlaybackSession> | null
  >(null);
  if (!sessionRef.current) {
    sessionRef.current = createVideoPreviewPlaybackSession({
      attachStream: (video, url, options) =>
        attachStreamingVideoPreview(video as HTMLVideoElement, url, options),
    });
  }
  const [snapshot, setSnapshot] = useState(sessionRef.current.getSnapshot());

  useEffect(() => sessionRef.current!.subscribe(setSnapshot), []);

  useEffect(() => {
    const session = sessionRef.current!;
    session.setSource(source);
    if (videoRef.current) {
      session.attach(videoRef.current as VideoPreviewElement);
    }
    return () => session.detach();
  }, [source]);

  return {
    videoRef,
    ...snapshot,
    seek: (timeMs: number) => sessionRef.current!.seek(timeMs),
    toggle: () => sessionRef.current!.toggle(),
    reportTime: (currentTimeSeconds: number) =>
      sessionRef.current!.reportTime(currentTimeSeconds),
    reportPlaying: (isPlaying: boolean) =>
      sessionRef.current!.reportPlaying(isPlaying),
    reportNativeError: () => sessionRef.current!.reportNativeError(),
  };
};
