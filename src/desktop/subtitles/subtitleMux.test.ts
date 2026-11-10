import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSubtitleMuxCommand, mergeVideoWithSubtitle, parseFfmpegProgressText, type SubtitleMuxProgress } from "./subtitleMux";

test("按视频总时长报告进度，不再以速度倍率作为反馈", () => {
  const progress = parseFfmpegProgressText("out_time_us=30000000\nspeed=42x\nprogress=continue\n", 60_000);
  expect(progress?.percent).toBe(50);
  expect(progress?.message).toBe("已处理 00:00:30 / 00:01:00 · 预计剩余不足 1 秒");
});

test("根据实际处理速度估算剩余时间，并随速度变化更新", () => {
  const parse = (speed: string) => parseFfmpegProgressText(`out_time_us=30000000\nspeed=${speed}\nprogress=continue`, 190_000);
  expect(parse("2x")?.message).toContain("预计剩余约 1 分 20 秒");
  expect(parse("4x")?.message).toContain("预计剩余约 40 秒");
  expect(parse("0.02x")?.message).toContain("预计剩余约 2 小时 14 分");
});

test("速度尚不可用时提示正在估算，不展示无效的剩余时间", () => {
  for (const speed of ["N/A", "0x", "-2x", "Infinityx", "2broken", ""]) {
    const progress = parseFfmpegProgressText(`out_time_us=30000000\nspeed=${speed}\nprogress=continue`, 60_000);
    expect(progress?.message).toContain("正在估算剩余时间");
    expect(progress?.message).not.toMatch(/NaN|Infinity|预计剩余约 0/);
  }
  expect(parseFfmpegProgressText("out_time_us=0\nspeed=2x\nprogress=continue", 60_000)?.message).toContain("正在估算剩余时间");
});

test("复制已到末尾与封装阶段均不展示零秒倒计时", () => {
  expect(parseFfmpegProgressText("out_time_us=70000000\nspeed=2x\nprogress=continue", 60_000)?.message).toContain("正在完成封装");
  expect(parseFfmpegProgressText("out_time_us=60000000\nspeed=2x\nprogress=end", 60_000)?.message).not.toContain("预计剩余");
});

test("接受零进度；时长未知时不编造百分比", () => {
  expect(parseFfmpegProgressText("out_time_ms=0\nprogress=continue", 60_000)?.percent).toBe(0);
  const unknown = parseFfmpegProgressText("out_time_ms=30000000\nspeed=42x\nprogress=continue");
  expect(unknown?.percent).toBeUndefined();
  expect(unknown?.message).toBe("已处理 00:00:30，视频总时长未知");
  expect(parseFfmpegProgressText("out_time_us=N/A\nprogress=continue", 60_000)).toBeNull();
});

test("输出结束标记只表示正在完成封装，不提前宣告成功", () => {
  const progress = parseFfmpegProgressText("out_time_us=70000000\nprogress=end", 60_000);
  expect(progress?.phase).toBe("finalizing");
  expect(progress?.percent).toBe(99);
  expect(progress?.message).toContain("正在完成封装");
  expect(parseFfmpegProgressText("out_time_us=-1000\nprogress=continue", 60_000)?.percent).toBe(0);
});

for (const exitCode of [0, 1]) {
  test(`流式读取源视频时长并等待真实退出后报告结果（${exitCode}）`, async () => {
    const events: SubtitleMuxProgress[] = [];
    const script = `
      process.stderr.write("Input #0, mov, from 'input.mp4':\\n  Dura");
      await Bun.sleep(15);
      process.stderr.write("tion: 00:01:00.00, start: 0.000000\\nInput #1, srt, from 'input.srt':\\n  Duration: 00:10:00.00\\n");
      await Bun.sleep(15);
      console.log("out_time_us=30000000\\nspeed=42x\\nprogress=continue");
      await Bun.sleep(15);
      console.error("[mp4] Starting second pass: moving the moov atom to the beginning of the file");
      await Bun.sleep(15);
      console.log("out_time_us=30000000\\nprogress=continue");
      await Bun.sleep(15);
      console.log("out_time_us=60000000\\nprogress=end");
      await Bun.sleep(15);
      process.exit(${exitCode});
    `;
    const task = mergeVideoWithSubtitle({ videoPath: "input.mp4", subtitlePath: "input.srt", outputPath: "output.mkv" }, {
      existsSync: (path) => path !== "output.mkv",
      onProgress: event => events.push(event),
      spawn: (_, options) => Bun.spawn([process.execPath, "-e", script], options),
    });
    if (exitCode === 0) await task;
    else await expect(task).rejects.toThrow();
    expect(events.find(event => event.phase === "running")?.percent).toBe(50);
    expect(events.find(event => event.phase === "running")?.durationMs).toBe(60_000);
    expect(events.find(event => event.phase === "finalizing")?.message).toBe("正在整理 MP4 文件，请稍候");
    const finalizingIndex = events.findIndex(event => event.phase === "finalizing");
    expect(events.slice(finalizingIndex).some(event => event.phase === "running")).toBe(false);
    expect(events.at(-1)?.phase).toBe(exitCode === 0 ? "completed" : "failed");
    expect(events.filter(event => event.phase === "completed")).toHaveLength(exitCode === 0 ? 1 : 0);
    if (exitCode === 0) expect(events.at(-1)?.percent).toBe(100);
    expect(events.findLast(event => event.diagnostics)?.diagnostics).toContain("Duration: 00:01:00.00");
  });
}

test("封装时排除封面图片流，保留源媒体和新增字幕", () => {
  const command = buildSubtitleMuxCommand({
    videoPath: "source.mp4",
    subtitlePath: "source.srt",
    outputPath: "merged.mkv",
  });
  const mappings = command.flatMap((arg, index) => arg === "-map" ? [command[index + 1]] : []);
  expect(mappings).toEqual(["0", "-0:disp:attached_pic?", "1:0"]);
});

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
      await expect(task).rejects.toThrow("命令与日志");
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

for (const [detail, expected] of [
  ["Error writing trailer: No space left on device", "磁盘空间不足"],
  ["Error opening output: Permission denied", "访问权限"],
  ["Unexpected muxer error", "命令与日志"],
]) {
  test(`失败提示提炼原因，完整日志只进入诊断：${detail}`, async () => {
    const log = `ffmpeg version 8.0\nconfiguration: --enable-many-options\n${detail}\nConversion failed!`;
    const events: SubtitleMuxProgress[] = [];
    let message = "";
    try {
      await mergeVideoWithSubtitle({ videoPath: "a.mp4", subtitlePath: "a.srt", outputPath: "a.mkv" }, {
        existsSync: path => path !== "a.mkv",
        onProgress: event => events.push(event),
        spawn: (_, options) => Bun.spawn([process.execPath, "-e", `console.error(${JSON.stringify(log)}); process.exit(1);`], options),
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(expected);
    expect(message.length).toBeLessThan(160);
    expect(message).not.toContain("ffmpeg version");
    expect(message).not.toContain("configuration:");
    expect(events.at(-1)?.message).toBe(message);
    expect(events.at(-1)?.diagnostics).toContain(log);
    expect(message).not.toContain("未完成文件");
  });
}

test("有失败残留时提示处理未完成文件，保留输入及残留文件", async () => {
  const dir = await mkdtemp(join(tmpdir(), "duck-mux-failure-"));
  const videoPath = join(dir, "source.mp4");
  const subtitlePath = join(dir, "source.srt");
  const outputPath = join(dir, "output.mkv");
  try {
    await writeFile(videoPath, "original video");
    await writeFile(subtitlePath, "original subtitle");
    await expect(mergeVideoWithSubtitle({ videoPath, subtitlePath, outputPath }, {
      spawn: (_, options) => Bun.spawn([process.execPath, "-e", `await Bun.write(${JSON.stringify(outputPath)}, "partial output"); console.error("No space left on device"); process.exit(1);`], options),
    })).rejects.toThrow("未完成文件");
    expect(await readFile(videoPath, "utf8")).toBe("original video");
    expect(await readFile(subtitlePath, "utf8")).toBe("original subtitle");
    expect(await readFile(outputPath, "utf8")).toBe("partial output");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});


test("MP4 output converts subtitles to mov_text and enables faststart without re-encoding AV", () => {
  const command = buildSubtitleMuxCommand({ videoPath: "source.mp4", subtitlePath: "source.srt", outputPath: "merged.MP4" });
  expect(command.slice(-5)).toEqual(["-c:s", "mov_text", "-movflags", "+faststart", "merged.MP4"]);
  expect(command.slice(command.indexOf("-c"), command.indexOf("-c") + 2)).toEqual(["-c", "copy"]);
  expect(command).not.toContain("-r");
  expect(command).not.toContain("-vf");
});

test("MKV output preserves styled subtitle streams", () => {
  const command = buildSubtitleMuxCommand({ videoPath: "source.mp4", subtitlePath: "styled.ass", outputPath: "merged.mkv" });
  expect(command.slice(-3)).toEqual(["-c", "copy", "merged.mkv"]);
  expect(command).not.toContain("mov_text");
  expect(command).not.toContain("-movflags");
});
