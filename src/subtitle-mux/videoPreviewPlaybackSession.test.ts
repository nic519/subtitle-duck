import { describe, expect, test } from "bun:test";
import { createVideoPreviewPlaybackSession } from "./videoPreviewPlaybackSession";

const createVideo = () => ({
  currentTime: 0,
  paused: false,
  play: async () => undefined,
  pause: () => undefined,
});

describe("video preview playback session", () => {
  test("restarts the FFmpeg stream adapter at the requested source time and cleans up", async () => {
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
    await Bun.sleep(160);
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

 test("coalesces rapid stream seeks and reuses buffered frames", async () => {
   let attachments = 0;
   const session = createVideoPreviewPlaybackSession({attachStream: () => {attachments++; return () => {};}});
   const video = {...createVideo(), buffered: {length: 1, start: () => 0, end: () => 10}};
   session.setSource({adapter: "ffmpeg-stream", url: "http://localhost/stream"});
   session.attach(video);
   session.seek(5000);
   expect(video.currentTime).toBe(5);
   expect(attachments).toBe(1);
   session.seek(20000); session.seek(30000); session.seek(40000);
   expect(session.getSnapshot().playheadMs).toBe(40000);
   session.reportTime(2);
   expect(session.getSnapshot().playheadMs).toBe(40000);
   await Bun.sleep(160);
   expect(attachments).toBe(2);
   session.seek(55000);
   session.detach();
   await Bun.sleep(160);
   expect(attachments).toBe(2);
 });
 test("requests compatibility fallback on native playback error", () => {
   let requested = 0;
   const session = createVideoPreviewPlaybackSession({attachStream: () => () => {}});
   session.setSource({adapter: "native", url: "local://video", requestFallback: async () => {requested++;}});
   session.attach(createVideo());
   session.reportNativeError();
   expect(requested).toBe(1);
   expect(session.getSnapshot().isUnavailable).toBe(false);
 });

test("switching sources cancels a pending stream seek", async () => {
  let attachments = 0;
  const session = createVideoPreviewPlaybackSession({
    attachStream: () => { attachments++; return () => {}; },
  });
  session.setSource({adapter: "ffmpeg-stream", url: "http://localhost/first"});
  session.attach(createVideo());
  session.seek(50000);
  session.setSource({adapter: "native", url: "local://second"});
  await Bun.sleep(160);
  expect(attachments).toBe(1);
  expect(session.getSnapshot().playheadMs).toBe(0);
});

test("honors playback changes while a stream seek is pending", async () => {
  const autoplay: boolean[] = [];
  const session = createVideoPreviewPlaybackSession({
    attachStream: (_video, _url, options) => {
      autoplay.push(options.autoplay);
      return () => {};
    },
  });
  const video = createVideo();
  session.setSource({adapter: "ffmpeg-stream", url: "http://localhost/video"});
  session.attach(video);
  session.seek(50000);
  video.paused = true;
  await Bun.sleep(160);
  expect(autoplay.at(-1)).toBe(false);
  session.seek(60000);
  video.paused = false;
  await Bun.sleep(160);
  expect(autoplay.at(-1)).toBe(true);
  session.detach();
});
