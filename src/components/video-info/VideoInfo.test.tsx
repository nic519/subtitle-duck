import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoInfoDetails, VideoInfo } from "./VideoInfo";
import { parseVideoMetadata } from "../../desktop/videoMetadata";

test("展示原视频参数和明确的未知值，不混淆码率", () => {
  const info = parseVideoMetadata(JSON.stringify({ format: { duration: "90", size: "10485760", bit_rate: "2500000" }, streams: [{ codec_type: "video", codec_name: "hevc", width: 3840, height: 2160, avg_frame_rate: "24/1" }] }));
  const html = renderToStaticMarkup(<VideoInfoDetails info={info} />);
  for (const value of ["已读取视频信息", "3840 × 2160", "HEVC", "24 fps", "视频码率", "未知", "总码率", "2.50 Mbps", "10.0 MiB", "00:01:30.000"]) expect(html).toContain(value);
  expect(html).not.toContain("NaN");
});

test("未选文件不显示信息，已选文件先显示读取状态", () => {
  expect(renderToStaticMarkup(<VideoInfo videoPath={null} />)).toBe("");
  expect(renderToStaticMarkup(<VideoInfo videoPath="/tmp/video.mp4" />)).toContain("正在读取视频信息");
});
