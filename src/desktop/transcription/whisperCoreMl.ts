import { existsSync as defaultExistsSync } from "node:fs";
import {
  mkdir as defaultMkdir,
  mkdtemp as defaultMkdtemp,
  readdir as defaultReaddir,
  rename as defaultRename,
  rm as defaultRm,
  stat as defaultStat,
} from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { tmpdir } from "node:os";

type SpawnProcess = ReturnType<typeof Bun.spawn>;

export type WhisperCoreMlStatus = {
  available: boolean;
  expectedPath: string | null;
  installedPath: string | null;
  error: string | null;
};

type CoreMlDeps = {
  existsSync?: typeof defaultExistsSync;
  mkdir?: typeof defaultMkdir;
  mkdtemp?: typeof defaultMkdtemp;
  readdir?: typeof defaultReaddir;
  rename?: typeof defaultRename;
  rm?: typeof defaultRm;
  stat?: typeof defaultStat;
  spawn?: (
    command: string[],
    options: Parameters<typeof Bun.spawn>[1]
  ) => SpawnProcess;
};

const stripWhisperQuantSuffix = (modelStem: string): string =>
  modelStem.replace(/-q\d+_[a-z0-9_]+$/i, "");

export const getWhisperCoreMlEncoderPath = (modelPath: string): string => {
  const extension = extname(modelPath);
  const stem = stripWhisperQuantSuffix(basename(modelPath, extension));
  return join(dirname(modelPath), `${stem}-encoder.mlmodelc`);
};

export const getWhisperCoreMlStatus = async (
  modelPath: string | null | undefined,
  deps: CoreMlDeps = {}
): Promise<WhisperCoreMlStatus> => {
  const stat = deps.stat ?? defaultStat;
  const normalizedModelPath = modelPath?.trim();
  if (!normalizedModelPath) {
    return {
      available: false,
      expectedPath: null,
      installedPath: null,
      error: "未配置 whisper 模型路径",
    };
  }

  const expectedPath = getWhisperCoreMlEncoderPath(normalizedModelPath);
  try {
    const pathStat = await stat(expectedPath);
    if (!pathStat.isDirectory()) {
      return {
        available: false,
        expectedPath,
        installedPath: null,
        error: "Core ML 加速包不是 mlmodelc 目录",
      };
    }
    return {
      available: true,
      expectedPath,
      installedPath: expectedPath,
      error: null,
    };
  } catch {
    return {
      available: false,
      expectedPath,
      installedPath: null,
      error: "未安装 Core ML 加速包",
    };
  }
};

const runUnzip = async (
  packagePath: string,
  outputDir: string,
  spawn: NonNullable<CoreMlDeps["spawn"]>
) => {
  const process = spawn(["unzip", "-q", "-o", packagePath, "-d", outputDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stderrText] = await Promise.all([
    process.exited,
    new Response(process.stderr as ReadableStream<Uint8Array>).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(stderrText.trim() || `unzip exited with code ${exitCode}`);
  }
};

const findMlmodelcDirectory = async (
  rootPath: string,
  readdir: NonNullable<CoreMlDeps["readdir"]>
): Promise<string | null> => {
  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "__MACOSX") continue;
    const entryPath = join(rootPath, entry.name);
    if (entry.name.endsWith(".mlmodelc")) return entryPath;
    const nestedPath = await findMlmodelcDirectory(entryPath, readdir);
    if (nestedPath) return nestedPath;
  }
  return null;
};

export const installWhisperCoreMlPackage = async (
  input: { modelPath: string; packagePath: string },
  deps: CoreMlDeps = {}
): Promise<WhisperCoreMlStatus> => {
  const existsSync = deps.existsSync ?? defaultExistsSync;
  const mkdir = deps.mkdir ?? defaultMkdir;
  const mkdtemp = deps.mkdtemp ?? defaultMkdtemp;
  const readdir = deps.readdir ?? defaultReaddir;
  const rename = deps.rename ?? defaultRename;
  const rm = deps.rm ?? defaultRm;
  const spawn = deps.spawn ?? ((command, options) => Bun.spawn(command, options));
  const normalizedModelPath = input.modelPath.trim();
  const normalizedPackagePath = input.packagePath.trim();

  if (!normalizedModelPath) throw new Error("请先配置 whisper 模型路径");
  if (!existsSync(normalizedModelPath)) {
    throw new Error(`whisper 模型文件不存在: ${normalizedModelPath}`);
  }
  if (!normalizedPackagePath) throw new Error("请选择 Core ML 加速包");
  if (!existsSync(normalizedPackagePath)) {
    throw new Error(`Core ML 加速包不存在: ${normalizedPackagePath}`);
  }
  if (!normalizedPackagePath.toLowerCase().endsWith(".zip")) {
    throw new Error("请选择 .mlmodelc.zip 格式的 Core ML 加速包");
  }

  const targetPath = getWhisperCoreMlEncoderPath(normalizedModelPath);
  const tempRoot = await mkdtemp(join(tmpdir(), "subtitle-duck-whisper-coreml-"));
  try {
    await runUnzip(normalizedPackagePath, tempRoot, spawn);
    const extractedPath = await findMlmodelcDirectory(tempRoot, readdir);
    if (!extractedPath) {
      throw new Error("压缩包中没有找到 .mlmodelc 目录");
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await rm(targetPath, { recursive: true, force: true });
    await rename(extractedPath, targetPath);
    return getWhisperCoreMlStatus(normalizedModelPath, { stat: deps.stat });
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
};
