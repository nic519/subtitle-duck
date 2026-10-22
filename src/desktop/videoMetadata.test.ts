import { describe, expect, test } from "bun:test";
import { parseVideoMetadata } from "./videoMetadata";

describe("原视频信息", () => {
  test("跳过封面，读取视频和音频轨道，区分总码率与视频码率", () => {
    const result = parseVideoMetadata(JSON.stringify({
      format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "12.5", size: "10000000", bit_rate: "6400000" },
      streams: [
        { codec_type: "video", codec_name: "mjpeg", disposition: { attached_pic: 1 } },
        { codec_type: "video", codec_name: "h264", width: 1920, height: 1080, avg_frame_rate: "30000/1001", bit_rate: "6000000" },
        { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2 },
      ],
    }));
    expect(result).toMatchObject({ videoCodec: "h264", width: 1920, height: 1080, durationMs: 12500, sizeBytes: 10000000, videoBitRate: 6000000, totalBitRate: 6400000, audioCodec: "aac", audioSampleRate: 48000, audioChannels: 2 });
    expect(result.frameRate).toBeCloseTo(29.97, 2);
  });
  test("未知数值不变成零或 NaN，帧率使用有效备用值", () => {
    const result = parseVideoMetadata(JSON.stringify({ streams: [{ codec_type: "video", avg_frame_rate: "0/0", r_frame_rate: "25/1" }] }));
    expect(result.videoBitRate).toBeNull();
    expect(result.durationMs).toBeNull();
    expect(result.frameRate).toBe(25);
    expect(result.audioCodec).toBeNull();
  });
  test("纯音频或封面不视为视频", () => {
    expect(() => parseVideoMetadata('{"streams":[{"codec_type":"audio"}]}')).toThrow("未找到视频轨道");
    expect(() => parseVideoMetadata('{"streams":[{"codec_type":"video","disposition":{"attached_pic":1}}]}')).toThrow("未找到视频轨道");
  });
});
