import Electrobun, { Electroview } from "electrobun/view";
import { DESKTOP_RPC_MAX_REQUEST_TIME_MS } from "./rpcRequestPolicy";
import type {
  DesktopRPC,
  SubtitleTranslationProgressEvent,
  WhisperTranscriptionProgressEvent,
} from "./rpcTypes";
import type { SubtitleMuxProgress } from "./subtitles/subtitleMux";
import {
  completeWhisperTranscriptionTask,
  failWhisperTranscriptionTask,
  startWhisperTranscriptionTask,
  updateWhisperTranscriptionTask,
  type WhisperTranscriptionTaskState,
} from "../subtitle-mux/transcriptionTaskState";
import type { WhisperTimeRange } from "./transcription/whisperTranscription";

const isElectrobun = Boolean(window.__electrobun);
type Listener<T> = (value: T) => void;

const muxListeners = new Set<Listener<SubtitleMuxProgress>>();
const translationListeners = new Set<Listener<SubtitleTranslationProgressEvent>>();
const transcriptionListeners = new Set<Listener<WhisperTranscriptionProgressEvent>>();
const taskListeners = new Set<Listener<WhisperTranscriptionTaskState | null>>();
let currentTask: WhisperTranscriptionTaskState | null = null;

const setTask = (task: WhisperTranscriptionTaskState | null) => {
  currentTask = task;
  taskListeners.forEach((listener) => listener(task));
};

const rpc = isElectrobun
  ? Electroview.defineRPC<DesktopRPC>({
      maxRequestTime: DESKTOP_RPC_MAX_REQUEST_TIME_MS,
      handlers: {
        requests: {},
        messages: {
          subtitleMuxProgress: (progress) => muxListeners.forEach((listener) => listener(progress)),
          subtitleTranslationProgress: (progress) => translationListeners.forEach((listener) => listener(progress)),
          whisperTranscriptionProgress: (progress) => transcriptionListeners.forEach((listener) => listener(progress)),
        },
      },
    })
  : null;

const electrobun = (rpc ? new Electrobun.Electroview({ rpc }) : null) as {
  rpc: NonNullable<typeof rpc>;
} | null;
const unavailable = (feature: string) => Promise.reject(new Error(`浏览器预览模式无法${feature}`));
const browserConfigGet = (key: string) => localStorage.getItem(key);
const browserConfigSet = (key: string, value: string) => {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
  return value;
};

export const desktopApi = {
  isDesktop: isElectrobun,
  configGet: (key: string) => electrobun?.rpc.request.configGet({ key }) ?? Promise.resolve(browserConfigGet(key)),
  configSet: (key: string, value: string) => electrobun?.rpc.request.configSet({ key, value }) ?? Promise.resolve(browserConfigSet(key, value)),
  openFilePath: (filePath: string) => electrobun?.rpc.request.openFilePath({ filePath }) ?? unavailable("打开本地文件"),
  revealFilePath: (filePath: string) => electrobun?.rpc.request.revealFilePath({ filePath }) ?? unavailable("打开文件夹"),
  moveFileToTrash: (_filePath: string) => unavailable("删除本地文件"),
  minimizeWindow: () => electrobun?.rpc.request.minimizeWindow() ?? Promise.resolve(),
  closeWindow: () => electrobun?.rpc.request.closeWindow() ?? Promise.resolve(),
  selectSubtitleMuxVideoFile: () => electrobun?.rpc.request.selectSubtitleMuxVideoFile() ?? unavailable("选择本地视频"),
  selectSubtitleMuxSubtitleFile: () => electrobun?.rpc.request.selectSubtitleMuxSubtitleFile() ?? unavailable("选择本地字幕"),
  selectSubtitleTranslationFile: () => electrobun?.rpc.request.selectSubtitleTranslationFile() ?? unavailable("选择本地 SRT 字幕"),
  selectWhisperModelFile: () => unavailable("选择 whisper.cpp 模型（已移除）"),
  selectWhisperBinaryFile: () => unavailable("选择 whisper.cpp 命令行（已移除）"),
  selectFfmpegBinaryFile: () => electrobun?.rpc.request.selectFfmpegBinaryFile() ?? unavailable("选择 FFmpeg"),
  selectFasterWhisperPythonFile: () => electrobun?.rpc.request.selectFasterWhisperPythonFile() ?? unavailable("选择 Python"),
  selectFasterWhisperModelDirectory: () => electrobun?.rpc.request.selectFasterWhisperModelDirectory() ?? unavailable("选择 Faster Whisper 模型"),
  selectWhisperCoreMlPackageFile: () => unavailable("安装 whisper.cpp Core ML（已移除）"),
  consumeLocalFileDrop: () => electrobun?.rpc.request.consumeLocalFileDrop() ?? Promise.resolve({ paths: [] }),
  getWhisperVideoDuration: (videoPath: string) => electrobun?.rpc.request.getWhisperVideoDuration({ videoPath }) ?? unavailable("读取视频时长"),
  getLocalVideoPreviewUrl: (videoPath: string) => electrobun?.rpc.request.getLocalVideoPreviewUrl({ videoPath }) ?? unavailable("预览本地视频"),
  getCompatibleVideoPreviewUrl: (videoPath: string) => electrobun?.rpc.request.getCompatibleVideoPreviewUrl({ videoPath }) ?? unavailable("转换视频预览"),
  getWhisperCoreMlStatus: (_modelPath?: string | null) => Promise.resolve({ available: false, expectedPath: null, installedPath: null, error: "whisper.cpp 支持已移除" }),
  installWhisperCoreMlPackage: (_input: unknown) => Promise.resolve({ available: false, expectedPath: null, installedPath: null, error: "whisper.cpp 支持已移除" }),
  getRuntimeEnvironment: () => electrobun?.rpc.request.getRuntimeEnvironment() ?? Promise.resolve({ platform: "browser" as NodeJS.Platform, arch: "browser", isAppleSilicon: false }),
  getFfmpegStatus: () => electrobun?.rpc.request.getFfmpegStatus() ?? Promise.resolve({ available: false, path: null, version: null, error: "仅桌面端支持" }),
  getWhisperStatus: () => Promise.resolve({ available: false, path: null, version: null, error: "whisper.cpp 支持已移除" }),
  getSubtitleTranscriptionEngine: () => Promise.resolve("faster-whisper" as const),
  getFasterWhisperStatus: () => electrobun?.rpc.request.getFasterWhisperStatus() ?? Promise.resolve({ available: false, path: null, version: null, error: "仅桌面端支持" }),
  mergeVideoWithSubtitle(input: { videoPath: string; subtitlePath: string; outputPath: string }) {
    return electrobun?.rpc.request.mergeVideoWithSubtitle(input) ?? unavailable("封装字幕");
  },
  onSubtitleMuxProgress(listener: Listener<SubtitleMuxProgress>) {
    muxListeners.add(listener);
    return () => { muxListeners.delete(listener); };
  },
  async transcribeVideoSubtitle(input: { videoPath: string; ranges: WhisperTimeRange[]; durationMs: number; language: string }, onProgress?: Listener<WhisperTranscriptionProgressEvent>) {
    if (!electrobun) return unavailable("生成本地字幕");
    setTask(startWhisperTranscriptionTask(input));
    const unsubscribe = this.onWhisperTranscriptionProgress((progress) => {
      if (progress.videoPath !== input.videoPath) return;
      if (currentTask?.input === input) setTask(updateWhisperTranscriptionTask(currentTask, progress));
      onProgress?.(progress);
    });
    try {
      const result = await electrobun.rpc.request.transcribeVideoSubtitle(input);
      if (currentTask?.input === input) setTask(completeWhisperTranscriptionTask(currentTask, result));
      return result;
    } catch (error) {
      if (currentTask?.input === input) setTask(failWhisperTranscriptionTask(currentTask, error instanceof Error ? error.message : String(error)));
      throw error;
    } finally {
      unsubscribe();
    }
  },
  cancelTranscribeVideoSubtitle: (input: { videoPath: string }) => electrobun?.rpc.request.cancelTranscribeVideoSubtitle(input) ?? unavailable("停止字幕生成"),
  getWhisperTranscriptionTask: () => currentTask,
  onWhisperTranscriptionTaskChange(listener: Listener<WhisperTranscriptionTaskState | null>) {
    taskListeners.add(listener);
    return () => { taskListeners.delete(listener); };
  },
  clearCompletedWhisperTranscriptionTask() {
    if (currentTask?.status !== "running") setTask(null);
  },
  async translateSubtitleFile(input: { subtitlePath: string; targetLanguage?: string | null; sourceLanguage?: string | null; maxBatchCharacters?: number | null }, onProgress?: Listener<SubtitleTranslationProgressEvent>) {
    if (!electrobun) return unavailable("翻译本地字幕");
    const unsubscribe = (progress: SubtitleTranslationProgressEvent) => {
      if (progress.subtitlePath === input.subtitlePath) onProgress?.(progress);
    };
    translationListeners.add(unsubscribe);
    try { return await electrobun.rpc.request.translateSubtitleFile(input); }
    finally { translationListeners.delete(unsubscribe); }
  },
  testSubtitleTranslationConnection: (proxyUrl?: string | null) =>
    electrobun?.rpc.request.testSubtitleTranslationConnection({ proxyUrl }) ?? unavailable("测试翻译服务"),
  onWhisperTranscriptionProgress(listener: Listener<WhisperTranscriptionProgressEvent>) {
    transcriptionListeners.add(listener);
    return () => { transcriptionListeners.delete(listener); };
  },
};
