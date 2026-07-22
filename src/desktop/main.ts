import { existsSync } from "node:fs";
import { join } from "node:path";
import { BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import { configGet, configSet } from "./configStore";
import {
  chooseFasterWhisperModelDirectory,
  chooseFasterWhisperPythonFile,
  chooseCliExecutableFile,
  chooseSubtitleMuxFile,
} from "./fileDialog";
import { openFilePath, revealFilePath } from "./fileService";
import { requestRaw } from "./httpRequest";
import { createLocalMediaPreviewServer } from "./localMediaPreview";
import { createLocalFileDropBroker } from "./file-drop/localFileDropBroker";
import { installNativeFileDropBridge } from "./file-drop/nativeFileDropBridge";
import { DESKTOP_RPC_MAX_REQUEST_TIME_MS } from "./rpcRequestPolicy";
import type { DesktopRPC } from "./rpcTypes";
import { mergeVideoWithSubtitle } from "./subtitles/subtitleMux";
import { translateSubtitleFile } from "./subtitles/subtitleTranslation";
import { resolveCliExecutable } from "./cliExecutable";
import { createCompatibleVideoPreview } from "./compatibleVideoPreview";
import { createGoogleTranslateTextService } from "./googleTranslate";
import { getFasterWhisperStatus } from "./transcription/fasterWhisperStatus";
import {
  getAvailableWhisperOutputPathForRanges,
  probeWhisperVideoDurationMs,
  transcribeVideoSubtitleRanges,
} from "./transcription/whisperTranscription";

let mainWindow: BrowserWindow | null = null;
const activeTranscriptions = new Map<string, AbortController>();
const activeSubtitleTranslations = new Map<string, AbortController>();
const previewServer = createLocalMediaPreviewServer();
const previewCacheDirectory = join(Utils.paths.userData, "compatible-video-preview");
const fileDropBroker = createLocalFileDropBroker();
const nativeFileDropBridge = installNativeFileDropBridge((paths) => {
  fileDropBroker.publish(paths);
});

const getCliStatus = async (executable: string, args: string[]) => {
  const path = resolveCliExecutable(executable);
  try {
    const process = Bun.spawn([path, ...args], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    return exitCode === 0
      ? { available: true, path, version: stdout.trim() || null, error: null }
      : { available: false, path, version: null, error: stderr.trim() || stdout.trim() || `exit ${exitCode}` };
  } catch (error) {
    return { available: false, path, version: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const getFfmpegPath = async () =>
  (await configGet("ffmpeg_binary_path"))?.trim() || "ffmpeg";

const resolveWithConfiguredFfmpeg = (ffmpegPath: string) =>
  (executable: string) =>
    resolveCliExecutable(executable === "ffmpeg" || executable === "ffprobe" ? ffmpegPath.replace(/ffmpeg$/, executable) : executable);

const getFasterWhisperConfig = async () => ({
  pythonPath: (await configGet("faster_whisper_python_path"))?.trim() || "python3",
  modelPath: (await configGet("faster_whisper_model_path"))?.trim() || "",
});

const rpc = BrowserView.defineRPC<DesktopRPC>({
  maxRequestTime: DESKTOP_RPC_MAX_REQUEST_TIME_MS,
  handlers: {
    requests: {
      configGet: ({ key }) => configGet(key),
      configSet: async ({ key, value }) => (await configSet(key, value)) ?? "",
      openFilePath: ({ filePath }) => openFilePath(filePath),
      revealFilePath: ({ filePath }) => revealFilePath(filePath),
      minimizeWindow: () => mainWindow?.minimize(),
      closeWindow: () => Utils.quit(),
      selectSubtitleMuxVideoFile: () => chooseSubtitleMuxFile({ openFileDialog: Utils.openFileDialog, allowedFileTypes: "mp4,mkv,avi,mov,wmv,m4v,ts,webm" }),
      selectSubtitleMuxSubtitleFile: () => chooseSubtitleMuxFile({ openFileDialog: Utils.openFileDialog, allowedFileTypes: "srt,ass,ssa" }),
      selectSubtitleTranslationFile: () => chooseSubtitleMuxFile({ openFileDialog: Utils.openFileDialog, allowedFileTypes: "srt" }),
      selectFfmpegBinaryFile: () => chooseCliExecutableFile({ openFileDialog: Utils.openFileDialog }),
      selectFasterWhisperPythonFile: () => chooseFasterWhisperPythonFile({ openFileDialog: Utils.openFileDialog }),
      selectFasterWhisperModelDirectory: () => chooseFasterWhisperModelDirectory({ openFileDialog: Utils.openFileDialog }),
      consumeLocalFileDrop: async () => ({
        paths: process.platform === "darwin" ? await fileDropBroker.consume() : [],
      }),
      getWhisperVideoDuration: async ({ videoPath }) => ({
        durationMs: await probeWhisperVideoDurationMs(videoPath, {
          resolveExecutable: resolveWithConfiguredFfmpeg(await getFfmpegPath()),
        }),
      }),
      getLocalVideoPreviewUrl: ({ videoPath }) => ({ url: previewServer.getPreviewUrl(videoPath) }),
      getCompatibleVideoPreviewUrl: async ({ videoPath }) => {
        const ffmpegPath = await getFfmpegPath();
        const result = await createCompatibleVideoPreview(
          { videoPath, cacheDirectory: previewCacheDirectory },
          { resolveExecutable: resolveWithConfiguredFfmpeg(ffmpegPath) }
        );
        return { url: previewServer.getPreviewUrl(result.previewPath), reused: result.reused };
      },
      getRuntimeEnvironment: () => ({ platform: process.platform, arch: process.arch, isAppleSilicon: process.platform === "darwin" && process.arch === "arm64" }),
      getFfmpegStatus: async () => getCliStatus(await getFfmpegPath(), ["-version"]),
      getFasterWhisperStatus: async () => getFasterWhisperStatus(await getFasterWhisperConfig()),
      mergeVideoWithSubtitle: async ({ videoPath, subtitlePath, outputPath }) =>
        mergeVideoWithSubtitle(
          {
            videoPath,
            subtitlePath,
            outputPath,
            ffmpegPath: await getFfmpegPath(),
          },
          { onProgress: (progress) => rpc.send.subtitleMuxProgress(progress) },
        ),
      transcribeVideoSubtitle: async ({ videoPath, ranges, durationMs, language }) => {
        const faster = await getFasterWhisperConfig();
        if (!faster.modelPath) throw new Error("请先选择 Faster Whisper CT2 模型目录");
        const status = await getFasterWhisperStatus(faster);
        if (!status.available) throw new Error(status.error ?? "Faster Whisper 不可用");
        const controller = new AbortController();
        const ffmpegPath = await getFfmpegPath();
        activeTranscriptions.get(videoPath)?.abort();
        activeTranscriptions.set(videoPath, controller);
        try {
          return await transcribeVideoSubtitleRanges({
            videoPath,
            outputPath: getAvailableWhisperOutputPathForRanges(videoPath, existsSync, ranges, durationMs),
            modelPath: faster.modelPath,
            language,
            ranges,
            fasterWhisperPythonPath: faster.pythonPath,
          }, {
            abortSignal: controller.signal,
            resolveExecutable: resolveWithConfiguredFfmpeg(ffmpegPath),
            onProgress: (progress) => rpc.send.whisperTranscriptionProgress({ videoPath, ...progress }),
          });
        } finally {
          if (activeTranscriptions.get(videoPath) === controller) activeTranscriptions.delete(videoPath);
        }
      },
      cancelTranscribeVideoSubtitle: ({ videoPath }) => activeTranscriptions.get(videoPath)?.abort(),
      translateSubtitleFile: async (input) => {
        const controller = new AbortController();
        activeSubtitleTranslations.get(input.subtitlePath)?.abort();
        activeSubtitleTranslations.set(input.subtitlePath, controller);
        const proxyUrl = (await configGet("subtitle_translation_proxy_url"))?.trim();
        const translateText = createGoogleTranslateTextService(requestRaw, {
          proxyConfig: proxyUrl ? { enabled: true, url: proxyUrl } : undefined,
        });
        try {
          return await translateSubtitleFile(input, {
            translateText: async (request) => (await translateText(request)).translatedText,
            onProgress: (progress) => rpc.send.subtitleTranslationProgress({ subtitlePath: input.subtitlePath, ...progress }),
            abortSignal: controller.signal,
          });
        } finally {
          if (activeSubtitleTranslations.get(input.subtitlePath) === controller) {
            activeSubtitleTranslations.delete(input.subtitlePath);
          }
        }
      },
      cancelTranslateSubtitleFile: ({ subtitlePath }) => activeSubtitleTranslations.get(subtitlePath)?.abort(),
      testSubtitleTranslationConnection: async ({ proxyUrl }) => {
        const configuredProxyUrl = proxyUrl?.trim() || (await configGet("subtitle_translation_proxy_url"))?.trim();
        try {
          const translateText = createGoogleTranslateTextService(requestRaw, {
            proxyConfig: configuredProxyUrl ? { enabled: true, url: configuredProxyUrl } : undefined,
          });
          await translateText({ text: "Connection test", targetLanguage: "zh-CN" });
          return { available: true, error: null };
        } catch (error) {
          return { available: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    },
    messages: {},
  },
});

mainWindow = new BrowserWindow({
  title: "字幕鸭",
  url: Bun.env.ELECTROBUN_RENDERER_URL ?? "views://main/index.html",
  frame: { x: 100, y: 100, width: 1100, height: 760 },
  titleBarStyle: "hiddenInset",
  renderer: "native",
  rpc,
});

process.once("exit", () => {
  activeTranscriptions.forEach((controller) => controller.abort());
  activeSubtitleTranslations.forEach((controller) => controller.abort());
  previewServer.stop();
  nativeFileDropBridge?.close();
});

const installNativeFileDropBridgeWhenReady = (attemptsRemaining = 8): void => {
  if (nativeFileDropBridge?.refresh()) return;
  if (attemptsRemaining <= 1) return;
  setTimeout(() => installNativeFileDropBridgeWhenReady(attemptsRemaining - 1), 125);
};
installNativeFileDropBridgeWhenReady();
