import { probeWhisperReadiness, prepareWhisper, type WhisperReadiness } from "./whisperReadiness";
import { runManagedProcess } from "./managedProcess";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fasterWhisperModels } from "../../subtitle-mux/fasterWhisperModels";
import { resolveCliExecutable } from "../cliExecutable";
import requirements from "../../../resources/faster-whisper/requirements.lock" with { type: "text" };

export type ManagedWhisperRequest = { kind: "prepare"; modelId: string; source?: "pypi" | "tuna" } | { kind: "install"; source?: "pypi" | "tuna" } | { kind: "model"; modelId: string };
export type ManagedWhisperSnapshot = {
  uv: { path: string; version: string; source: "local" | "managed" } | null;
  pythonPath: string | null;
  components: WhisperReadiness | null;
  models: { id: string; path: string }[];
  task: { state: "idle" | "running" | "done" | "error" | "cancelled"; message: string; percent: number | null; log: string; startedAt: number | null; lastActivityAt: number | null; activity: string };
};
const UV_VERSION = "0.13.5";
// 固定发行包及摘要，禁止执行未经校验的网络安装脚本。
const uvAssets: Record<string, [string, string]> = {
  "darwin-arm64": ["aarch64-apple-darwin.tar.gz", "743f85035a1996ecb350659e01cd9faea9709829be09b1b4b03c73eaf3c9cd73"],
  "darwin-x64": ["x86_64-apple-darwin.tar.gz", "b0f52b0e3945b4107d89024ea38e625683011fbfc05a0d98f9fa2d6dcee28c66"],
  "linux-arm64": ["aarch64-unknown-linux-gnu.tar.gz", "4bb69cf95ed13f23713bb7bc09f241896ea0c75b7c557e615a20604b82f9c403"],
  "linux-x64": ["x86_64-unknown-linux-gnu.tar.gz", "f68d291c75783122dad58ab77def0e13f3233f358731db5d6d7e8715603b928f"],
  "win32-x64": ["x86_64-pc-windows-msvc.zip", "a38b8d1902b7cfbc76b423ba1bb456f623f42064cdc72628b6075b89afd1019a"],
  "win32-arm64": ["aarch64-pc-windows-msvc.zip", "09f47edf90726084a70f9426f6e3ca4f46e9bf7cbf23b1716ec64d60b055fae3"],
};

async function fileHash(path: string, algorithm = "sha256", gitBlob = false) {
  const hash = createHash(algorithm);
  if (gitBlob) hash.update(`blob ${(await stat(path)).size}\0`);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

// 流式写入临时文件，校验通过才替换正式文件；重试复用已校验的完整文件。
export async function downloadVerifiedFile(input: {
  url: string; path: string; sha256?: string; gitSha1?: string; signal: AbortSignal;
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
  onProgress?: (received: number, total: number) => void;
}) {
  const { path, signal } = input;
  signal.throwIfAborted();
  const expected = input.sha256 ?? input.gitSha1;
  if (!expected) throw new Error("下载文件缺少校验摘要");
  const valid = async (file: string) => {
    try { return await fileHash(file, input.sha256 ? "sha256" : "sha1", !input.sha256) === expected; }
    catch { return false; }
  };
  if (await valid(path)) return;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.part`;
  try {
    const response = await (input.fetcher ?? fetch)(input.url, { signal: AbortSignal.any([signal, AbortSignal.timeout(30 * 60_000)]) });
    if (!response.ok || !response.body) throw new Error(`下载失败 HTTP ${response.status}`);
    const file = await open(temporary, "w");
    const reader = response.body.getReader();
    let received = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const { done, value } = await reader.read();
        if (done) break;
        // FileHandle.write 允许短写，必须循环保证每个分块完整落盘。
        let offset = 0;
        while (offset < value.length) offset += (await file.write(value, offset, value.length - offset)).bytesWritten;
        received += value.length;
        input.onProgress?.(received, Number(response.headers.get("content-length")) || 0);
      }
    } finally { await reader.cancel().catch(() => {}); await file.close(); }
    if (!await valid(temporary)) throw new Error("下载校验失败，请重试");
    signal.throwIfAborted();
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

// 本地 uv 只读检测：兼顾 Finder 启动时缺少 shell PATH 的常见安装位置。
export async function detectLocalUv(run: (args: string[]) => Promise<string>) {
  const name = process.platform === "win32" ? "uv.exe" : "uv";
  const candidates = [resolveCliExecutable(name), join(homedir(), ".local", "bin", name), join(homedir(), ".cargo", "bin", name)];
  for (const path of new Set(candidates)) {
    try {
      const version = (await run([path, "--version"])).trim();
      const match = /^uv (\d+)\.(\d+)\.(\d+)/.exec(version);
      // 本项目使用的 managed-python 与 pip sync 参数以 uv 0.6 为最低版本。
      if (match && (Number(match[1]) > 0 || Number(match[2]) >= 6)) return { path, version, source: "local" as const };
    } catch { /* 本地不存在或无法运行时继续检查其他位置。 */ }
  }
  return null;
}

export function createManagedWhisper(options: {
  root: string;
  savePython: (path: string) => Promise<void>;
  saveModel?: (path: string) => Promise<void>;
  getConfig?: () => Promise<{pythonPath:string;modelPath:string}>;
  bootstrapUv?: (signal: AbortSignal) => Promise<string>;
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const { root } = options;
  // 环境路径随锁文件变化，安装新版不破坏已经在使用的旧环境。
  const revision = createHash("sha256").update(requirements).digest("hex").slice(0, 12);
  const envPath = join(root, `python-env-${revision}`);
  const python = join(envPath, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const readyFile = join(envPath, ".ready");
  const state: ManagedWhisperSnapshot = { uv: null, pythonPath: null, components: null, models: [], task: { state: "idle", message: "", percent: null, log: "", startedAt: null, lastActivityAt: null, activity: "" } };
  let controller: AbortController | null = null;
  const log = (text: string) => {
    state.task.log = (state.task.log + text).slice(-12_000);
    state.task.lastActivityAt = Date.now();
    const line = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").split(/[\r\n]/).map(line => line.trim()).filter(Boolean).at(-1);
    if (line) state.task.activity = line.slice(0, 250);
  };
  const phase = (message: string) => { state.task.message = message; state.task.percent = null; state.task.lastActivityAt = Date.now(); state.task.activity = ""; };

  async function refreshComponents() {
    const config = await options.getConfig?.() ?? {pythonPath: await Bun.file(python).exists() ? python : "python3", modelPath: ""};
    state.components = await probeWhisperReadiness(config);
  }

  async function run(args: string[], signal: AbortSignal, quiet = false) {
    signal.throwIfAborted();
    return runManagedProcess(args, {
      signal,
      onOutput: quiet ? undefined : log,
      env: {
        ...process.env, UV_PYTHON_INSTALL_DIR: join(root, "python"), UV_CACHE_DIR: join(root, "cache"),
        UV_PYTHON_PREFERENCE: "only-managed", UV_NO_PROGRESS: "1",
        UV_HTTP_TIMEOUT: "30", UV_HTTP_RETRIES: "1", UV_CONCURRENT_DOWNLOADS: "4",
      },
    });
  }

  async function ensureUv(signal: AbortSignal) {
    phase("检测本地 uv");
    state.uv = await detectLocalUv(args => run(args, AbortSignal.any([signal, AbortSignal.timeout(5000)]), true));
    if (state.uv) return state.uv.path;
    const asset = uvAssets[`${process.platform}-${process.arch}`];
    if (!asset) throw new Error("此平台暂不支持自动安装，请使用手动配置");
    const uvDir = join(root, `uv-${UV_VERSION}`);
    const executable = join(uvDir, process.platform === "win32" ? "uv.exe" : `uv-${asset[0].replace(/\.tar\.gz$/, "")}/uv`);
    try {
      const version = (await run([executable, "--version"], signal, true)).trim();
      state.uv = { path: executable, version, source: "managed" }; return executable;
    } catch { signal.throwIfAborted(); }
    phase("下载应用专用 uv");
    const archive = join(root, `uv-${asset[0]}`);
    await downloadVerifiedFile({ url: `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-${asset[0]}`, path: archive, sha256: asset[1], signal, onProgress: (n, total) => { state.task.percent = total ? Math.round(n / total * 100) : null; state.task.lastActivityAt = Date.now(); } });
    await mkdir(uvDir, { recursive: true });
    // Windows 自带 tar 可读取 zip；其他平台使用 tar.gz，路径均通过参数数组传递。
    await run(["tar", "-xf", archive, "-C", uvDir], signal);
    if (process.platform !== "win32") await chmod(executable, 0o755);
    const version = (await run([executable, "--version"], signal, true)).trim();
    state.uv = { path: executable, version, source: "managed" };
    await rm(archive, { force: true });
    return executable;
  }

  async function install(signal: AbortSignal, source: "pypi" | "tuna") {
    await mkdir(root, { recursive: true });
    const uv = await (options.bootstrapUv ?? ensureUv)(signal);
    if (!await Bun.file(readyFile).exists()) {
      phase("安装专用 Python 3.12");
      if (!await Bun.file(python).exists()) await run([uv, "--no-config", "venv", "--python", "3.12", envPath], signal);
      const lock = join(root, "requirements.lock");
      await writeFile(lock, requirements);
      phase(`安装锁定版本的识别依赖 · ${source === "tuna" ? "清华镜像" : "官方 PyPI"}`);
      await run([uv, "--no-config", "pip", "sync", "--python", python, "--index-url", source === "tuna" ? "https://pypi.tuna.tsinghua.edu.cn/simple" : "https://pypi.org/simple", "--require-hashes", "--only-binary", ":all:", lock], signal);
    }
    phase("验证 Python 与识别依赖");
    try {
      await run([python, "-c", "import faster_whisper, ctranslate2, av, onnxruntime; print(faster_whisper.__version__)"], signal);
    } catch (error) {
      await rm(readyFile, { force: true });
      throw error;
    }
    signal.throwIfAborted();
    await writeFile(readyFile, revision);
    await options.savePython(python);
    state.pythonPath = python;
    await refreshComponents();
    phase("识别环境已安装并启用；请选择模型");
  }

  async function hasModel(id: string) {
    const model = fasterWhisperModels.find(item => item.id === id);
    if (!model) return false;
    const path = join(root, "models", id);
    try {
      return await Bun.file(join(path, ".complete")).exists() && (await Promise.all(model.files.map(async file => {
        const info = await stat(join(path, file)); return info.isFile() && info.size > 0;
      }))).every(Boolean);
    } catch { return false; }
  }

  async function downloadModel(id: string, signal: AbortSignal) {
    const model = fasterWhisperModels.find(item => item.id === id)!;
    phase(`读取 ${id} 模型信息`);
    const response = await (options.fetcher ?? fetch)(`https://huggingface.co/api/models/${model.repo}?blobs=true`, { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
    if (!response.ok) throw new Error(`无法获取模型信息 HTTP ${response.status}`);
    const metadata = await response.json() as { sha: string; siblings: { rfilename: string; blobId: string; lfs?: { sha256: string } }[] };
    if (!/^[a-f0-9]{40}$/.test(metadata.sha)) throw new Error("模型版本信息无效");
    // 固定一次下载的 revision；半成品保存在独立目录，不能成为当前模型。
    const target = join(root, "models", id);
    const staging = `${target}.download`;
    await mkdir(staging, { recursive: true });
    for (const [index, filename] of model.files.entries()) {
      const file = metadata.siblings.find(item => item.rfilename === filename);
      if (!file) throw new Error(`模型缺少 ${filename}`);
      phase(`下载 ${id} · ${filename}（${index + 1}/${model.files.length}）`);
      await downloadVerifiedFile({ url: `https://huggingface.co/${model.repo}/resolve/${metadata.sha}/${filename}`, path: join(staging, filename), sha256: file.lfs?.sha256, gitSha1: file.blobId, signal, fetcher: options.fetcher,
        onProgress: (n, total) => { state.task.percent = total ? Math.round(n / total * 100) : null; state.task.lastActivityAt = Date.now(); },
      });
    }
    for (const file of model.files.filter(file => file.endsWith(".json"))) JSON.parse(await readFile(join(staging, file), "utf8"));
    if (await Bun.file(readyFile).exists()) {
      phase(`加载 ${id} 并验证短音频转写`);
      await run([python, "-c", "import sys,numpy as np; from faster_whisper import WhisperModel; m=WhisperModel(sys.argv[1],device='cpu',compute_type='int8',local_files_only=True); s,_=m.transcribe(np.zeros(16000,dtype=np.float32),task='transcribe',language=None); list(s)", staging], signal);
    }
    signal.throwIfAborted();
    await writeFile(join(staging, ".complete"), metadata.sha);
    // 新目录完全校验后再交换；修复残缺目录失败时保留旧文件供重试。
    const backup = `${target}.previous`;
    let moved = false;
    try {
      await rm(backup, { recursive: true, force: true });
      try { await rename(target, backup); moved = true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      await rename(staging, target);
    } catch (error) {
      if (moved) await rename(backup, target);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
    phase(`${id} 已下载并校验，点击“使用此模型”切换`);
  }

  return {
    refreshComponents,
    async snapshot(): Promise<ManagedWhisperSnapshot> {
      state.pythonPath = await Bun.file(readyFile).exists() && await Bun.file(python).exists() ? python : null;
      const installed = await Promise.all(fasterWhisperModels.map(async model => {
        const path = join(root, "models", model.id);
        return await hasModel(model.id) ? { id: model.id, path } : null;
      }));
      state.models = installed.filter((item): item is { id: string; path: string } => item !== null);
      return structuredClone(state);
    },
    async detectUv() {
      if (controller) return;
      await refreshComponents();
      state.uv = await detectLocalUv(args => run(args, AbortSignal.timeout(5000), true));
      if (!state.uv) {
        const asset = uvAssets[`${process.platform}-${process.arch}`];
        if (asset) {
          const path = join(root, `uv-${UV_VERSION}`, process.platform === "win32" ? "uv.exe" : `uv-${asset[0].replace(/\.tar\.gz$/, "")}/uv`);
          try { state.uv = { path, version: (await run([path, "--version"], AbortSignal.timeout(5000), true)).trim(), source: "managed" }; } catch { /* 未安装时由用户点击安装。 */ }
        }
      }
    },
    start(request: ManagedWhisperRequest) {
      if (controller) throw new Error("已有安装或下载任务正在进行");
      if ((request.kind === "install" || request.kind === "prepare") && request.source !== undefined && !["pypi", "tuna"].includes(request.source)) throw new Error("未知依赖下载源");
      if (request.kind !== "install" && (!["model", "prepare"].includes(request.kind) || !fasterWhisperModels.some(model => model.id === request.modelId))) throw new Error("未知模型");
      controller = new AbortController();
      const signal = controller.signal;
      state.task = { state: "running", message: "准备中", percent: null, log: "", startedAt: Date.now(), lastActivityAt: Date.now(), activity: "" };
      void (async () => {
        try {
          if (request.kind === "prepare") {
            if (!options.saveModel) throw new Error("未配置模型保存入口");
            const modelPath = join(root,"models",request.modelId);
            await prepareWhisper({
              install: () => install(signal,request.source ?? "pypi"),
              download: async () => { if (!await hasModel(request.modelId)) await downloadModel(request.modelId,signal); },
              validate: async () => {
                phase("校验识别环境与模型");
                await run([python,"-c","import sys,numpy as np; from faster_whisper import WhisperModel; m=WhisperModel(sys.argv[1],device='cpu',compute_type='int8',local_files_only=True); s,_=m.transcribe(np.zeros(16000,dtype=np.float32),task='transcribe'); list(s)",modelPath],signal);
              },
              activate: async () => { await options.saveModel!(modelPath); await refreshComponents(); phase("全部就绪，可以生成字幕"); },
            },signal);
          }
          else if (request.kind === "install") await install(signal, request.source ?? "pypi");
          else if (!await hasModel(request.modelId)) await downloadModel(request.modelId, signal);
          else phase("模型已下载，点击“使用此模型”切换");
          state.task.state = "done";
        } catch (error) {
          state.task.state = signal.aborted ? "cancelled" : "error";
          state.task.message = signal.aborted ? "已取消，可重新开始；已校验的模型文件会复用" : `操作失败：${error instanceof Error ? error.message : String(error)}`;
          log(`\n${state.task.message}`);
        } finally { controller = null; state.task.percent = null; }
      })();
    },
    cancel() { controller?.abort(); },
  };
}
