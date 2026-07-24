import { describe, expect, test } from "bun:test";
import { createVideoPreviewSession } from "./videoPreviewSession";

describe("video preview session", () => {
  test("publishes the native adapter before upgrading to the FFmpeg stream adapter", async () => {
    const session = createVideoPreviewSession({
      probeDuration: async () => 90_000,
      getNativeSource: async () => "local://source.mp4",
      getStreamSource: async () => "http://127.0.0.1/stream/source.mp4",
    });
    const adapters: Array<string | null> = [];
    session.subscribe((snapshot) =>
      adapters.push(snapshot.source?.adapter ?? null),
    );

    await session.load("/videos/source.mp4");

    expect(adapters).toEqual([null, null, "native", "ffmpeg-stream"]);
    expect(session.getSnapshot()).toMatchObject({
      status: "ready",
      videoPath: "/videos/source.mp4",
      durationMs: 90_000,
      source: {
        adapter: "ffmpeg-stream",
        url: "http://127.0.0.1/stream/source.mp4",
      },
    });
  });

  test("ignores a stale adapter result after another video is loaded", async () => {
    let releaseFirstStream: (() => void) | null = null;
    const firstStream = new Promise<void>((resolve) => {
      releaseFirstStream = resolve;
    });
    const session = createVideoPreviewSession({
      probeDuration: async (path) => path.includes("first") ? 10_000 : 20_000,
      getNativeSource: async (path) => `local://${path}`,
      getStreamSource: async (path) => {
        if (path.includes("first")) await firstStream;
        return `stream://${path}`;
      },
    });

    const firstLoad = session.load("/videos/first.mp4");
    await Promise.resolve();
    await Promise.resolve();
    await session.load("/videos/second.mp4");
    releaseFirstStream?.();
    await firstLoad;

    expect(session.getSnapshot()).toMatchObject({
      videoPath: "/videos/second.mp4",
      durationMs: 20_000,
      source: { url: "stream:///videos/second.mp4" },
    });
  });
});
