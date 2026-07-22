import {
  existsSync as defaultExistsSync,
  statSync as defaultStatSync,
} from "node:fs";
import { resolveCliExecutable } from "../cliExecutable";

type SpawnProcess = ReturnType<typeof Bun.spawn>;

export type FasterWhisperStatus = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};

export const getFasterWhisperStatus = async (
  input: { pythonPath: string; modelPath: string },
  deps: {
    existsSync?: typeof defaultExistsSync;
    statSync?: typeof defaultStatSync;
    resolveExecutable?: (executable: string) => string;
    spawn?: (
      command: string[],
      options: Parameters<typeof Bun.spawn>[1]
    ) => SpawnProcess;
  } = {}
): Promise<FasterWhisperStatus> => {
  const pythonPath = input.pythonPath.trim() || "python3";
  const modelPath = input.modelPath.trim();
  const existsSync = deps.existsSync ?? defaultExistsSync;
  const statSync = deps.statSync ?? defaultStatSync;
  const resolveExecutable = deps.resolveExecutable ?? resolveCliExecutable;
  const spawn = deps.spawn ?? ((command, options) => Bun.spawn(command, options));
  const resolvedPath = resolveExecutable(pythonPath);

  if (!modelPath) {
    return {
      available: false,
      path: resolvedPath,
      version: null,
      error: "未配置 Faster Whisper CT2 模型目录",
    };
  }
  if (!existsSync(modelPath)) {
    return {
      available: false,
      path: resolvedPath,
      version: null,
      error: `CT2 模型目录不存在: ${modelPath}`,
    };
  }
  if (resolvedPath.includes("/")) {
    try {
      const stat = statSync(resolvedPath);
      if (!stat.isFile() || (stat.mode & 0o111) === 0) {
        return {
          available: false,
          path: resolvedPath,
          version: null,
          error: `所选 Python 路径不是可执行文件: ${resolvedPath}。请选择 Python 文件，例如 ~/.venv/bin/python。`,
        };
      }
    } catch {
      return {
        available: false,
        path: resolvedPath,
        version: null,
        error: `找不到所选 Python 可执行文件: ${resolvedPath}`,
      };
    }
  }

  try {
    const process = spawn(
      [
        resolvedPath,
        "-c",
        "import faster_whisper; print(f'faster-whisper {faster_whisper.__version__}')",
      ],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout as ReadableStream<Uint8Array>).text(),
      new Response(process.stderr as ReadableStream<Uint8Array>).text(),
      process.exited,
    ]);
    if (exitCode !== 0) {
      const errorText = stderr.trim() || stdout.trim();
      return {
        available: false,
        path: resolvedPath,
        version: null,
        error: /No module named ['"]faster_whisper['"]/i.test(errorText)
          ? `所选 Python 未安装 faster-whisper。请运行: ${pythonPath} -m pip install faster-whisper`
          : errorText || "无法导入 faster-whisper",
      };
    }
    return {
      available: true,
      path: resolvedPath,
      version: stdout.trim() || null,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      path: resolvedPath,
      version: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
