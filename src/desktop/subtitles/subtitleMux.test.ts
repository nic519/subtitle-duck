import { expect, test } from "bun:test";
import { mergeVideoWithSubtitle, type SubtitleMuxProgress } from "./subtitleMux";

for (const exitCode of [0, 1]) {
  test(`保留真实参数、日志和退出码（${exitCode}）`, async () => {
    const input = {
      videoPath: "C:\\视频 目录\\input.mp4",
      subtitlePath: "C:\\字幕\\it's 中文.srt",
      outputPath: "C:\\输出\\merged.mkv",
    };
    const events: SubtitleMuxProgress[] = [];
    let actualCommand: string[] = [];
    const task = mergeVideoWithSubtitle(input, {
      existsSync: (path) => path !== input.outputPath,
      resolveExecutable: () => "C:\\Program Files\\ffmpeg.exe",
      onProgress: (event) => events.push(event),
      spawn: (command, options) => {
        actualCommand = command;
        expect(events[0]?.diagnostics).toContain("实际参数（JSON）");
        return Bun.spawn([process.execPath, "-e", `console.error('subtitle stream diagnostic'); process.exit(${exitCode})`], options);
      },
    });
    if (exitCode === 0) {
      expect(await task).toEqual({ outputPath: input.outputPath });
    } else {
      await expect(task).rejects.toThrow("subtitle stream diagnostic");
    }
    const report = events.findLast((event) => event.diagnostics)?.diagnostics;
    expect(report).toContain(JSON.stringify(actualCommand, null, 2));
    expect(report).toContain(`退出码: ${exitCode}`);
    expect(report).toContain("subtitle stream diagnostic");
    expect(actualCommand).toContain(input.subtitlePath);
  });
}

test("启动失败时仍可回查命令", async () => {
  const events: SubtitleMuxProgress[] = [];
  await expect(mergeVideoWithSubtitle({ videoPath: "a.mp4", subtitlePath: "a.srt", outputPath: "a.mkv" }, {
    existsSync: (path) => path !== "a.mkv",
    resolveExecutable: () => "missing-ffmpeg",
    onProgress: (event) => events.push(event),
    spawn: () => { throw new Error("ENOENT"); },
  })).rejects.toThrow("未找到 ffmpeg");
  expect(events.at(-1)?.diagnostics).toContain("missing-ffmpeg");
  expect(events.at(-1)?.diagnostics).toContain("启动失败");
});
