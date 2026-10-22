import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createManagedFfmpeg, getFfprobePath, verifyFfmpegArchive } from "./managedFfmpeg";

test("ffprobe 路径保留 Windows 后缀", () => {
  expect(getFfprobePath("C:\\tools\\ffmpeg.exe")).toBe("C:\\tools\\ffprobe.exe");
  expect(getFfprobePath("/tools/ffmpeg")).toBe("/tools/ffprobe");
});

test("下载内容必须匹配锁定的校验值", () => {
  const data = Buffer.from("binary");
  const integrity = `sha512-${createHash("sha512").update(data).digest("base64")}`;
  expect(() => verifyFfmpegArchive(data, integrity)).not.toThrow();
  expect(() => verifyFfmpegArchive(Buffer.from("changed"), integrity)).toThrow("校验失败");
});

async function waitForInstall(manager: ReturnType<typeof createManagedFfmpeg>) {
  for (let i = 0; i < 100 && manager.snapshot().state === "running"; i++) await Bun.sleep(10);
  return manager.snapshot();
}

test("已有本机环境时复用，不下载", async () => {
  let saved = "";
  const manager = createManagedFfmpeg({ root: "/unused", getLocalPath: async () => "/local/ffmpeg", savePath: async path => { saved = path; }, fetch: (() => { throw new Error("不应下载"); }) as typeof fetch });
  manager.start();
  expect((await waitForInstall(manager)).state).toBe("done");
  expect(saved).toBe("/local/ffmpeg");
});

test("校验失败不启用文件，清理临时目录并允许重试", async () => {
  const root = await mkdtemp(join(tmpdir(), "ffmpeg-test-"));
  let saved = false;
  try {
    const manager = createManagedFfmpeg({ root, platform: "darwin", arch: "arm64", getLocalPath: async () => null, savePath: async () => { saved = true; }, fetch: (async () => new Response("broken")) as typeof fetch });
    manager.start();
    expect((await waitForInstall(manager)).message).toContain("校验失败");
    expect(saved).toBe(false);
    expect(await readdir(root)).toEqual([]);
    manager.start();
    expect((await waitForInstall(manager)).state).toBe("error");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("取消检测不保存配置，重复启动不会产生第二个任务", async () => {
  let finish!: (path: string | null) => void;
  let saved = false;
  const manager = createManagedFfmpeg({ root: "/unused", getLocalPath: () => new Promise(resolve => { finish = resolve; }), savePath: async () => { saved = true; } });
  manager.start();
  expect(() => manager.start()).toThrow("正在安装");
  manager.cancel();
  finish("/local/ffmpeg");
  expect((await waitForInstall(manager)).state).toBe("cancelled");
  expect(saved).toBe(false);
});
