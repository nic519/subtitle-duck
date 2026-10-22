import { probeVideoMetadata } from "./videoMetadata";
import { existsSync } from "node:fs";
import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import { configGet, configSet } from "./configStore";
import {
  chooseFasterWhisperModelDirectory,
  chooseFasterWhisperPythonFile,
  chooseCliExecutableFile,
  chooseSubtitleMuxFile,
} from "./fileDialog";
import { openFilePath, revealFilePath } from "./fileService";
import { openExternalLink } from "./externalLinks";
import { requestRaw } from "./httpRequest";
import { createLocalMediaPreviewServer } from "./localMediaPreview";
import { createLocalFileDropBroker } from "./file-drop/localFileDropBroker";
import { installNativeFileDropBridge } from "./file-drop/nativeFileDropBridge";
import { DESKTOP_RPC_MAX_REQUEST_TIME_MS } from "./rpcRequestPolicy";
import type { DesktopRPC } from "./rpcTypes";
import { mergeVideoWithSubtitle } from "./subtitles/subtitleMux";
import { translateSubtitleFile } from "./subtitles/subtitleTranslation";
import { resolveCliExecutable } from "./cliExecutable";
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
const fileDropBroker = createLocalFileDropBroker();
const nativeFileDropBridge = installNativeFileDropBridge((paths) => {
  fileDropBroker.publish(paths);
});

// 注册 macOS 原生菜单，让菜单、系统快捷键和窗口控制按钮复用平台默认行为。
ApplicationMenu.setApplicationMenu([
  {
    label: "字幕鸭",
    submenu: [
      { role: "hide", accelerator: "CommandOrControl+H" },
      { role: "hideOthers", accelerator: "CommandOrControl+Alt+H" },
      { role: "showAll" },
      { type: "separator" },
      { role: "quit", accelerator: "CommandOrControl+Q" },
    ],
  },
  // WKWebView 的编辑快捷键通过原生菜单角色分发给当前输入框。
  {
    label: "编辑",
    submenu: [
      { label: "撤销", role: "undo", accelerator: "CommandOrControl+Z" },
      { label: "重做", role: "redo", accelerator: "CommandOrControl+Shift+Z" },
      { type: "separator" },
      { label: "剪切", role: "cut", accelerator: "CommandOrControl+X" },
      { label: "复制", role: "copy", accelerator: "CommandOrControl+C" },
      { label: "粘贴", role: "paste", accelerator: "CommandOrControl+V" },
      { label: "全选", role: "selectAll", accelerator: "CommandOrControl+A" },
    ],
  },
  {
    label: "窗口",
    submenu: [
      { role: "minimize", accelerator: "CommandOrControl+M" },
      { role: "zoom" },
      { type: "separator" },
      { role: "close", accelerator: "CommandOrControl+W" },
      { type: "separator" },
      { role: "toggleFullScreen" },
    ],
  },
]);

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

const rpc: ReturnType<typeof BrowserView.defineRPC<DesktopRPC>> =
  BrowserView.defineRPC<DesktopRPC>({
  maxRequestTime: DESKTOP_RPC_MAX_REQUEST_TIME_MS,
  handlers: {
    requests: {
      configGet: ({ key }) => configGet(key),
      configSet: async ({ key, value }) => (await configSet(key, value)) ?? "",
      openFilePath: ({ filePath }) => openFilePath(filePath),
      revealFilePath: ({ filePath }) => revealFilePath(filePath),
      selectSubtitleMuxVideoFile: () => chooseSubtitleMuxFile({ openFileDialog: Utils.openFileDialog, allowedFileTypes: "mp4,mkv,avi,mov,wmv,m4v,ts,webm" }),
      selectSubtitleMuxSubtitleFile: () => chooseSubtitleMuxFile({ openFileDialog: Utils.openFileDialog, allowedFileTypes: "srt,ass,ssa" }),
      selectSubtitleTranslationFile: () => chooseSubtitleMuxFile({ openFileDialog: Utils.openFileDialog, allowedFileTypes: "srt" }),
      selectFfmpegBinaryFile: () => chooseCliExecutableFile({ openFileDialog: Utils.openFileDialog }),
      selectFasterWhisperPythonFile: () => chooseFasterWhisperPythonFile({ openFileDialog: Utils.openFileDialog }),
      selectFasterWhisperModelDirectory: () => chooseFasterWhisperModelDirectory({ openFileDialog: Utils.openFileDialog }),
      consumeLocalFileDrop: async () => ({
        paths: process.platform === "darwin" ? await fileDropBroker.consume() : [],
      }),
      getVideoMetadata: async ({ videoPath }) => probeVideoMetadata(videoPath, resolveWithConfiguredFfmpeg(await getFfmpegPath())),
      getWhisperVideoDuration: async ({ videoPath }) => ({
        durationMs: await probeWhisperVideoDurationMs(videoPath, {
          resolveExecutable: resolveWithConfiguredFfmpeg(await getFfmpegPath()),
        }),
      }),
      getLocalVideoPreviewUrl: ({ videoPath }) => ({ url: previewServer.getPreviewUrl(videoPath) }),
      getCompatibleVideoPreviewUrl: async ({ videoPath }) => {
        const ffmpegPath = resolveCliExecutable(await getFfmpegPath());
        return {
          url: previewServer.getStreamingPreviewUrl({ filePath: videoPath, ffmpegPath }),
          reused: false,
        };
      },
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
        const proxyUrl = input.proxyUrl?.trim();
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
        // 空字符串明确表示关闭代理，不能回退到已保存的地址。
        const configuredProxyUrl = proxyUrl?.trim();
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
// target="_blank" 在桌面 WebView 中只发出事件，需要显式交给系统浏览器。
// SDK 的 BrowserView.on 类型尚未包含此事件，使用同一事件总线的窗口专属事件。
Electrobun.events.on(`new-window-open-${mainWindow.webview.id}`, (event: { data: { detail: unknown } }) => {
  openExternalLink(event.data.detail, Utils.openExternal);
});
if (Bun.env.SUBTITLE_DUCK_VERIFY_LOCAL_APP === "1") {
  console.log("[subtitle-duck] BrowserWindow created");
}

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
