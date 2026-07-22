import { describe, expect, test } from "bun:test";
import { buildStreamingPreviewSeekUrl } from "./streamingVideoPreview";

describe("streaming video preview", () => {
  test("restarts a streaming preview at the requested source timestamp", () => {
    expect(
      buildStreamingPreviewSeekUrl(
        "http://127.0.0.1:1234/stream/id/video.mkv",
        1_800_000,
      ),
    ).toBe(
      "http://127.0.0.1:1234/stream/id/video.mkv?startMs=1800000",
    );
  });
});
