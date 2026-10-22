import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import releases from "./releases.json";
import { runManagedProcess } from "../transcription/managedProcess";

export type FfmpegInstallStatus = {
  state: "idle" | "running" | "done" | "error" | "cancelled";
  message: string;
  percent: number | null;
};

// Windows 的 ffprobe 与 ffmpeg 同目录，保留 .exe 后缀。
export const getFfprobePath = (path: string) => path.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");

export function verifyFfmpegArchive(bytes: Uint8Array, integrity: string) {
  if (`sha512-${createHash("sha512").update(bytes).digest("base64")}` !== integrity) {
    throw new Error("下载文件校验失败，请重试");
  }
}

// 下载固定版本并核对源码内锁定的校验值，不运行 npm 安装脚本、不修改系统 PATH。
export function createManagedFfmpeg(options: {
  root: string;
  getLocalPath: () => Promise<string | null>;
  savePath: (path: string) => Promise<void>;
  platform?: string;
  arch?: string;
  fetch?: typeof fetch;
  run?: typeof runManagedProcess;
}) {
  let status: FfmpegInstallStatus = { state: "idle", message: "", percent: null };
  let controller: AbortController | null = null;
  const platform = options.platform ?? process.platform;
  const target = `${platform}-${options.arch ?? process.arch}`;
  const release = releases[target as keyof typeof releases];
  const run = options.run ?? runManagedProcess;
  const request = options.fetch ?? fetch;
  const suffix = platform === "win32" ? ".exe" : "";

  const install = async (signal: AbortSignal) => {
    // 点击安装时再次检查，防止检测后用户已在系统中装好。
    const local = await options.getLocalPath();
    signal.throwIfAborted();
    if (local) { await options.savePath(local); return; }
    if (!release) throw new Error(`暂不支持 ${target} 自动安装，请手动选择 FFmpeg`);
    await mkdir(options.root, { recursive: true });
    const staging = await mkdtemp(join(options.root, ".install-"));
    try {
      for (const [index, tool] of (["ffmpeg", "ffprobe"] as const).entries()) {
        const asset = release[tool];
        status.message = `下载 ${tool}`;
        // 超时覆盖整个文件传输；取消后绝不发布未完成的目录。
        const downloadSignal = AbortSignal.any([signal, AbortSignal.timeout(180_000)]);
        const response = await request(asset.url, { signal: downloadSignal });
        if (!response.ok || !response.body) throw new Error(`下载 ${tool} 失败：HTTP ${response.status}`);
        const size = Number(response.headers.get("content-length"));
        const reader = response.body.getReader();
        const archive = join(staging, `${tool}.tgz`);
        const writer = Bun.file(archive).writer();
        let received = 0;
        try {
          while (true) {
            downloadSignal.throwIfAborted();
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;
            if (received > 200 * 1024 * 1024) throw new Error("下载文件超过大小限制");
            writer.write(value);
            status.percent = size > 0 ? Math.min(89, Math.round(index * 45 + received / size * 45)) : null;
          }
        } finally { await writer.end(); await reader.cancel().catch(() => {}); }
        verifyFfmpegArchive(await readFile(archive), asset.integrity);
        status.message = `安装 ${tool}`;
        const unpack = join(staging, tool);
        await mkdir(unpack);
        // 仅提取经过校验的指定文件，避免覆盖目录中的其他内容。
        await run(["tar", "-xzf", archive, "-C", unpack, `package/${tool}${suffix}`], { signal });
        const binary = join(staging, `${tool}${suffix}` + ".ready");
        await copyFile(join(unpack, "package", `${tool}${suffix}`), binary);
        if (platform !== "win32") await chmod(binary, 0o755);
        await rm(unpack, { recursive: true, force: true });
        await rename(binary, join(staging, `${tool}${suffix}`));
        await rm(archive);
      }
      status.message = "校验 FFmpeg";
      status.percent = 95;
      for (const tool of ["ffmpeg", "ffprobe"]) {
        await run([join(staging, `${tool}${suffix}`), "-version"], { signal, timeoutMs: 15_000 });
      }
      signal.throwIfAborted();
      // 每次安装发布到独立目录，正在运行或手动配置的旧版本不受影响。
      const destination = join(options.root, `bin-${crypto.randomUUID()}`);
      await rename(staging, destination);
      try { await options.savePath(join(destination, `ffmpeg${suffix}`)); }
      catch (error) { await rm(destination, { recursive: true, force: true }); throw error; }
    } finally { await rm(staging, { recursive: true, force: true }); }
  };

  return {
    snapshot: (): FfmpegInstallStatus => ({ ...status }),
    start() {
      if (controller) throw new Error("FFmpeg 正在安装");
      controller = new AbortController();
      const signal = controller.signal;
      status = { state: "running", message: "检测本机 FFmpeg", percent: null };
      void install(signal).then(() => {
        status = { state: "done", message: "", percent: 100 };
      }).catch(error => {
        status = { state: signal.aborted ? "cancelled" : "error", message: signal.aborted ? "已取消" : String(error instanceof Error ? error.message : error), percent: null };
      }).finally(() => { controller = null; });
    },
    cancel() { controller?.abort(new Error("已取消")); },
  };
}
