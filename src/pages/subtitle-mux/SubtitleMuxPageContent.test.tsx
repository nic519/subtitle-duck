import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SubtitleTranscriptionProgress,
  TranscriptionCommands,
} from "./SubtitleMuxPageContent";

describe("subtitle generation progress", () => {
  test("renders as a one-pixel top progress line", () => {
    const html = renderToStaticMarkup(
      <SubtitleTranscriptionProgress percent={42} />,
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="字幕生成总体进度"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain("h-px");
    expect(html).toContain("width:42%");
    expect(html).not.toContain("识别进度");
  });

  test("clamps progress to the valid range", () => {
    const html = renderToStaticMarkup(
      <SubtitleTranscriptionProgress percent={120} />,
    );

    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain("width:100%");
  });
});

describe("transcription commands", () => {
  test("keeps command output collapsed by default", () => {
    const html = renderToStaticMarkup(
      <TranscriptionCommands commands={["python3 transcribe.py"]} />,
    );

    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).toContain("执行命令");
    expect(html).toContain("python3 transcribe.py");
  });
});
