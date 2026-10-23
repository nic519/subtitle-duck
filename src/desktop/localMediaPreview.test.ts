import { describe, expect, test } from "bun:test";
import { createLocalMediaPreviewServer } from "./localMediaPreview";

describe("local media preview streaming", () => {
  test("returns fragmented MP4 bytes without waiting for ffmpeg to exit", async () => {
    let command: string[] = [];
    const server = createLocalMediaPreviewServer({
      existsSync: () => true,
      spawn: (nextCommand) => {
        command = nextCommand;
        return {
          stdout: new Blob(["fragment"]).stream(),
          stderr: new Blob([]).stream(),
          exited: new Promise<number>(() => undefined),
          kill: () => {},
        } as ReturnType<typeof Bun.spawn>;
      },
    });

    try {
      const url = server.getStreamingPreviewUrl({
        filePath: "/media/source.mkv",
        ffmpegPath: "/usr/local/bin/ffmpeg",
      });
      const response = await fetch(`${url}?startMs=12500`);

      expect(response.headers.get("content-type")).toBe("video/mp4");
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(await response.text()).toBe("fragment");
      expect(command).toContain("12.500");
    } finally {
      server.stop();
    }
  });
});

test("stops transcoding when the preview request is aborted", async () => {
  let killed = false;
  const server = createLocalMediaPreviewServer({
    existsSync: () => true,
    spawn: () => ({
      stdout: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); } }),
      exited: new Promise<number>(() => {}),
      kill: () => { killed = true; },
    }) as ReturnType<typeof Bun.spawn>,
  });
  try {
    const url = server.getStreamingPreviewUrl({filePath: "/video.mkv", ffmpegPath: "ffmpeg"});
    const controller = new AbortController();
    const response = await fetch(url, {signal: controller.signal});
    const reader = response.body!.getReader();
    await reader.read();
    controller.abort();
    for (let attempt = 0; attempt < 20 && !killed; attempt++) await Bun.sleep(10);
    expect(killed).toBe(true);
  } finally { server.stop(); }
});
