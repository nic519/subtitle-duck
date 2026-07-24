import { describe, expect, test } from "bun:test";
import { createVideoPreviewPlaybackSession } from "./videoPreviewPlaybackSession";

const createVideo = () => ({
  currentTime: 0,
  paused: false,
  play: async () => undefined,
  pause: () => undefined,
});

describe("video preview playback session", () => {
  test("restarts the FFmpeg stream adapter at the requested source time and cleans up", () => {
    const attachments: Array<{ url: string; autoplay: boolean }> = [];
    let cleanups = 0;
    const session = createVideoPreviewPlaybackSession({
      attachStream: (_video, url, options) => {
        attachments.push({ url, autoplay: options.autoplay });
        return () => { cleanups += 1; };
      },
    });
    const video = createVideo();
    session.setSource({
      adapter: "ffmpeg-stream",
      url: "http://127.0.0.1/stream/source.mp4",
    });
    session.attach(video);

    session.seek(42_000);
    session.detach();

    expect(attachments).toEqual([
      { url: "http://127.0.0.1/stream/source.mp4?startMs=0", autoplay: false },
      { url: "http://127.0.0.1/stream/source.mp4?startMs=42000", autoplay: true },
    ]);
    expect(cleanups).toBe(2);
    expect(session.getSnapshot().playheadMs).toBe(42_000);
  });

  test("seeks the native adapter without attaching the FFmpeg stream", () => {
    let attachments = 0;
    const session = createVideoPreviewPlaybackSession({
      attachStream: () => {
        attachments += 1;
        return () => undefined;
      },
    });
    const video = createVideo();
    session.setSource({ adapter: "native", url: "local://source.mp4" });
    session.attach(video);

    session.seek(12_500);

    expect(video.currentTime).toBe(12.5);
    expect(attachments).toBe(0);
  });
});
