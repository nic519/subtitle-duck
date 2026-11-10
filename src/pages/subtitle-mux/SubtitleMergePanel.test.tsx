import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { SubtitleMergePanel } from "./SubtitleMergePanel";

const props = {
  darkMode: true, activeTool: "merge", videoPath: "/video.mp4", subtitlePath: "/sub.srt",
  outputPath: "/video.merged.mp4", canStart: true, isMerging: true,
  ffmpegStatus: null, progressMessage: "已处理 00:00:30 / 00:01:00",
  mergeProgressPercent: 50, muxDiagnostics: null, mergeStatusTone: "neutral", mergeStatusMessage: null,
  onDropPaths() {}, onChooseVideo() {}, onChooseSubtitle() {}, onRefreshFfmpegStatus() {},
  onStart() {}, onClear() {}, onRevealOutput() {},
} satisfies ComponentProps<typeof SubtitleMergePanel>;

test("软合并时显示实际百分比、进度条和已处理时长", () => {
  const html = renderToStaticMarkup(<SubtitleMergePanel {...props} />);
  expect(html).toContain('role="progressbar"');
  expect(html).toContain('aria-label="视频字幕软合并进度"');
  expect(html).toContain('aria-valuenow="50"');
  expect(html).toContain("width:50%");
  expect(html).toContain("50%");
  expect(html).toContain("已处理 00:00:30 / 00:01:00");
});

test("时长未知时使用不定进度，不显示虚假的零百分比", () => {
  const html = renderToStaticMarkup(<SubtitleMergePanel {...props} mergeProgressPercent={null} progressMessage="正在读取视频并准备软合并" />);
  expect(html).toContain('role="progressbar"');
  expect(html).not.toContain("aria-valuenow");
  expect(html).not.toContain("0%");
  expect(html).toContain("正在读取视频并准备软合并");
});

test("完成与出错后不残留运行中的进度条", () => {
  for (const tone of ["success", "error"] as const) {
    const html = renderToStaticMarkup(<SubtitleMergePanel {...props} isMerging={false} mergeStatusTone={tone} mergeStatusMessage={tone === "error" ? "输出文件已存在" : "合并完成"} />);
    expect(html).not.toContain('role="progressbar"');
    expect(html).toContain(tone === "error" ? "输出文件已存在" : "打开文件夹");
  }
});

test("失败原因可被读屏获知，完整诊断默认折叠且不挤占提示", () => {
  const message = "输出磁盘空间不足，无法保存合并视频。请腾出足够空间后重试。";
  const log = "ffmpeg version 8.0\nconfiguration: --enable-many-options\nNo space left on device";
  const html = renderToStaticMarkup(<SubtitleMergePanel {...props} isMerging={false} mergeStatusTone="error" mergeStatusMessage={message} muxDiagnostics={log} />);
  expect(html).toContain('role="alert"');
  const [visible, diagnostic] = html.split("<details");
  expect(visible).toContain(message);
  expect(visible).not.toContain("ffmpeg version");
  expect(diagnostic).toContain(log);
  expect(diagnostic).not.toMatch(/^[^>]*\bopen(?:\s|=|>)/);
});
