import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { desktopApi } from "../../desktop/client";
import {
  addSubtitleGenerationMarker,
  createInitialSubtitleGenerationSegments,
  getValidSubtitleGenerationRanges,
  removeSubtitleGenerationSegment,
  updateSubtitleGenerationSegment,
  validateSubtitleGenerationSegments,
  type SubtitleGenerationSegment,
} from "../../subtitle-mux/subtitleGenerationSegments";
import {
  mergeSubtitleMuxDraftWithDropPaths,
  type SubtitleMuxDraft,
} from "../../subtitle-mux/subtitleMuxModel";
import { createSubtitleTranslationSession } from "../../subtitle-mux/subtitleTranslationSession";
import {
  createVideoPreviewSession,
  type VideoPreviewSource,
} from "../../subtitle-mux/videoPreviewSession";
import {
  addSuccessfulFasterWhisperModel,
  parseFasterWhisperModelHistory,
} from "../../subtitle-mux/fasterWhisperModelHistory";
import { revealInFolder } from "../../utils/fileUtils";
import {
  SubtitleMuxPageContent,
  type SubtitleToolId,
} from "./SubtitleMuxPageContent";

const EMPTY_DRAFT: SubtitleMuxDraft = {
  videoPath: null,
  subtitlePath: null,
  outputPath: null,
  error: null,
};

const SUBTITLE_MUX_ACTIVE_TOOL_CONFIG_KEY = "subtitle_mux_active_tool";
const FASTER_WHISPER_MODEL_HISTORY_CONFIG_KEY =
  "faster_whisper_successful_model_history";

const isSubtitleToolId = (value: string | null): value is SubtitleToolId =>
  value === "merge" ||
  value === "generate" ||
  value === "translate";

type FfmpegStatus = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};

type FasterWhisperStatus = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};

interface SubtitleMuxPageProps {
  initialActiveTool?: SubtitleToolId;
}

export const SubtitleMuxPage = ({
  initialActiveTool = "merge",
}: SubtitleMuxPageProps) => {
  const { darkMode } = useTheme();
  const [draft, setDraft] = useState<SubtitleMuxDraft>(EMPTY_DRAFT);
  const [isMerging, setIsMerging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCancelingGeneration, setIsCancelingGeneration] = useState(false);
  const [mergeStatus, setMergeStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string | null;
  }>({ tone: "neutral", message: null });
  const [generationStatus, setGenerationStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string | null;
  }>({ tone: "neutral", message: null });
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);
  const [ffmpegPath, setFfmpegPath] = useState("ffmpeg");
  const [fasterWhisperStatus, setFasterWhisperStatus] =
    useState<FasterWhisperStatus | null>(null);
  const [fasterWhisperPythonPath, setFasterWhisperPythonPath] =
    useState<string | null>("python3");
  const [fasterWhisperModelPath, setFasterWhisperModelPath] =
    useState<string | null>(null);
  const [fasterWhisperModelHistory, setFasterWhisperModelHistory] = useState<
    string[]
  >([]);
  const [activeTool, setActiveTool] =
    useState<SubtitleToolId>(initialActiveTool);
  const [generationVideoPath, setGenerationVideoPath] = useState<string | null>(null);
  const [generationVideoPreview, setGenerationVideoPreview] =
    useState<VideoPreviewSource | null>(null);
  const [generationDurationMs, setGenerationDurationMs] =
    useState<number | null>(null);
  const [generationSegments, setGenerationSegments] = useState<
    SubtitleGenerationSegment[]
  >([]);
  const [activeGenerationSegmentId, setActiveGenerationSegmentId] = useState<
    string | null
  >(null);
  const [generationRangeError, setGenerationRangeError] = useState<
    string | null
  >(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [transcriptionProgressMessage, setTranscriptionProgressMessage] =
    useState<string | null>(null);
  const [transcriptionProgressPercent, setTranscriptionProgressPercent] =
    useState<number | null>(null);
  const [transcriptionCommandLines, setTranscriptionCommandLines] = useState<
    string[]
  >([]);
  const [generatedSubtitlePath, setGeneratedSubtitlePath] =
    useState<string | null>(null);
  const generationSegmentCounterRef = useRef(0);
  const videoPreviewSessionRef = useRef<
    ReturnType<typeof createVideoPreviewSession> | null
  >(null);
  if (!videoPreviewSessionRef.current) {
    videoPreviewSessionRef.current = createVideoPreviewSession({
      probeDuration: async (videoPath) =>
        (await desktopApi.getWhisperVideoDuration(videoPath)).durationMs,
      getNativeSource: async (videoPath) =>
        (await desktopApi.getLocalVideoPreviewUrl(videoPath)).url,
      getStreamSource: async (videoPath) =>
        (await desktopApi.getCompatibleVideoPreviewUrl(videoPath)).url,
    });
  }
  const subtitleTranslationSessionRef = useRef<
    ReturnType<typeof createSubtitleTranslationSession> | null
  >(null);
  if (!subtitleTranslationSessionRef.current) {
    subtitleTranslationSessionRef.current = createSubtitleTranslationSession({
      loadProxyUrl: () => desktopApi.configGet("subtitle_translation_proxy_url"),
      saveProxyUrl: (value) =>
        desktopApi.configSet("subtitle_translation_proxy_url", value),
      testConnection: (proxyUrl) =>
        desktopApi.testSubtitleTranslationConnection(proxyUrl),
      translate: (input, onProgress) =>
        desktopApi.translateSubtitleFile(input, onProgress),
      cancel: (input) => desktopApi.cancelTranslateSubtitleFile(input),
    });
  }
  const [subtitleTranslation, setSubtitleTranslation] = useState(
    subtitleTranslationSessionRef.current.getSnapshot(),
  );
  const subtitleTranslationPath = subtitleTranslation.subtitlePath;
  const subtitleTranslationTargetLanguage = subtitleTranslation.targetLanguage;
  const subtitleTranslationBatchCharacters = subtitleTranslation.batchCharacters;
  const subtitleTranslationProxyUrl = subtitleTranslation.proxyUrl;
  const subtitleTranslationConnectionStatus = subtitleTranslation.connection.status;
  const subtitleTranslationConnectionError = subtitleTranslation.connection.error;
  const translatedSubtitlePath = subtitleTranslation.translatedPath;
  const subtitleTranslationProgress = subtitleTranslation.progress;
  const subtitleTranslationStatus = subtitleTranslation.presentation;
  const isTranslatingSubtitle =
    subtitleTranslation.status === "translating" ||
    subtitleTranslation.status === "canceling";

  const canStart = useMemo(
    () =>
      Boolean(
        draft.videoPath &&
          draft.subtitlePath &&
          draft.outputPath &&
          !draft.error &&
          ffmpegStatus?.available !== false
      ),
    [draft, ffmpegStatus]
  );

  const generationRanges = useMemo(
    () => getValidSubtitleGenerationRanges(generationSegments),
    [generationSegments]
  );

  const canGenerateSubtitle = Boolean(
      generationVideoPath &&
      generationDurationMs !== null &&
      generationRanges.length > 0 &&
      !generationRangeError &&
      fasterWhisperStatus?.available !== false
  );
  const subtitleTranslationOutputPath = subtitleTranslation.expectedOutputPath;

  useEffect(() => {
    void Promise.all([
      desktopApi.configGet("ffmpeg_binary_path"),
      desktopApi.getFfmpegStatus(),
    ])
      .then(([path, status]) => {
        setFfmpegPath(path?.trim() || "ffmpeg");
        setFfmpegStatus(status);
      })
      .catch((error) => {
        setFfmpegStatus({
          available: false,
          path: "ffmpeg",
          version: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, []);

  useEffect(() =>
    videoPreviewSessionRef.current!.subscribe((preview) => {
      setGenerationVideoPath(preview.videoPath);
      setGenerationDurationMs(preview.durationMs);
      setGenerationVideoPreview(preview.source);
      if (preview.status === "error" && preview.error) {
        setGenerationStatus({ tone: "error", message: preview.error });
      } else if (preview.status === "ready" && preview.error) {
        setGenerationStatus({
          tone: "error",
          message: `兼容预览生成失败：${preview.error}`,
        });
      }
    }),
  []);

  useEffect(() => {
    if (initialActiveTool !== "merge") {
      void desktopApi.configSet(
        SUBTITLE_MUX_ACTIVE_TOOL_CONFIG_KEY,
        initialActiveTool
      );
      return;
    }
    void desktopApi.configGet(SUBTITLE_MUX_ACTIVE_TOOL_CONFIG_KEY).then((value) => {
      if (isSubtitleToolId(value)) setActiveTool(value);
    });
  }, [initialActiveTool]);

  const handleChangeActiveTool = (toolId: SubtitleToolId) => {
    setActiveTool(toolId);
    void desktopApi.configSet(SUBTITLE_MUX_ACTIVE_TOOL_CONFIG_KEY, toolId);
  };

  const refreshFfmpegStatus = async () => {
    const status = await desktopApi.getFfmpegStatus();
    setFfmpegStatus(status);
    return status;
  };

  const saveFfmpegPath = async (value: string) => {
    const path = value.trim() || "ffmpeg";
    try {
      await desktopApi.configSet("ffmpeg_binary_path", path === "ffmpeg" ? "" : path);
      setFfmpegPath(path);
      await refreshFfmpegStatus();
    } catch (error) {
      setMergeStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const refreshFasterWhisperStatus = async () => {
    const status = await desktopApi.getFasterWhisperStatus();
    setFasterWhisperStatus(status);
    return status;
  };

  useEffect(() => {
    void Promise.all([
      desktopApi.configGet("faster_whisper_python_path"),
      desktopApi.configGet("faster_whisper_model_path"),
      desktopApi.configGet(FASTER_WHISPER_MODEL_HISTORY_CONFIG_KEY),
      desktopApi.getFasterWhisperStatus(),
    ])
      .then(([pythonPath, modelPath, modelHistory, status]) => {
        setFasterWhisperPythonPath(pythonPath?.trim() || "python3");
        setFasterWhisperModelPath(modelPath?.trim() || null);
        setFasterWhisperModelHistory(
          parseFasterWhisperModelHistory(modelHistory),
        );
        setFasterWhisperStatus(status);
      })
      .catch((error) => {
        setFasterWhisperStatus({
          available: false,
          path: "python3",
          version: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, []);

  useEffect(() => {
    const session = subtitleTranslationSessionRef.current!;
    const unsubscribe = session.subscribe(setSubtitleTranslation);
    void session.initialize();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (activeTool !== "translate") return;
    void subtitleTranslationSessionRef.current!.testConnection().catch(() => undefined);
  }, [activeTool]);

  useEffect(() => {
    return desktopApi.onSubtitleMuxProgress((progress) => {
      setProgressMessage(progress.message);
    });
  }, []);

  const handleDropPaths = (paths: string[]) => {
    const nextDraft = mergeSubtitleMuxDraftWithDropPaths(draft, paths);
    setDraft(nextDraft);
    setProgressMessage(null);
    setMergeStatus(
      nextDraft.error
        ? { tone: "error", message: nextDraft.error }
        : { tone: "neutral", message: "已选择视频和字幕，准备合并" }
    );
  };

  const handleChoosePath = async (kind: "video" | "subtitle") => {
    try {
      const selectedPath =
        kind === "video"
          ? await desktopApi.selectSubtitleMuxVideoFile()
          : await desktopApi.selectSubtitleMuxSubtitleFile();
      if (!selectedPath) return;
      const nextDraft = mergeSubtitleMuxDraftWithDropPaths(draft, [selectedPath]);
      setDraft(nextDraft);
      setProgressMessage(null);
      setMergeStatus(
        nextDraft.error
          ? { tone: "error", message: nextDraft.error }
          : { tone: "neutral", message: "已选择视频和字幕，准备合并" }
      );
    } catch (error) {
      setMergeStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const loadGenerationVideo = async (path: string) => {
    const trimmedPath = path.trim();
    if (!trimmedPath) return;
    desktopApi.clearCompletedWhisperTranscriptionTask();

    setGenerationVideoPath(trimmedPath);
    setGenerationVideoPreview(null);
    setGenerationDurationMs(null);
    setGenerationSegments([]);
    setActiveGenerationSegmentId(null);
    setGenerationRangeError(null);
    generationSegmentCounterRef.current = 0;
    setGeneratedSubtitlePath(null);
    setTranscriptionProgressMessage(null);
    setTranscriptionProgressPercent(null);
    setTranscriptionCommandLines([]);
    setIsCancelingGeneration(false);
    setGenerationStatus({ tone: "neutral", message: null });

    try {
      const preview = await videoPreviewSessionRef.current!.load(trimmedPath);
      if (preview.videoPath !== trimmedPath || preview.durationMs === null) return;
      const initialSegmentId = `segment-${++generationSegmentCounterRef.current}`;
      setGenerationSegments(
        createInitialSubtitleGenerationSegments(
          preview.durationMs,
          initialSegmentId,
        )
      );
      setActiveGenerationSegmentId(initialSegmentId);
      if (!preview.error) {
        setGenerationStatus({ tone: "neutral", message: null });
      }
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  useEffect(() => {
    let hydratedTaskInput: object | null = null;

    const unsubscribe = desktopApi.onWhisperTranscriptionTaskChange((task) => {
      if (task.status === "idle" || !task.input) return;
      if (hydratedTaskInput !== task.input) {
        hydratedTaskInput = task.input;
        const restoredSegments = task.input.ranges.map((range, index) => ({
          id: `segment-${index + 1}`,
          startMs: range.startMs,
          endMs: range.endMs,
        }));
        setGenerationVideoPath(task.input.videoPath);
        setGenerationDurationMs(task.input.durationMs);
        setGenerationSegments(restoredSegments);
        setActiveGenerationSegmentId(restoredSegments[0]?.id ?? null);
        setGenerationRangeError(null);
        generationSegmentCounterRef.current = restoredSegments.length;
        const preview = videoPreviewSessionRef.current!.getSnapshot();
        if (
          preview.videoPath !== task.input.videoPath ||
          preview.durationMs === null
        ) {
          void videoPreviewSessionRef.current!.load(task.input.videoPath);
        }
      }

      setTranscriptionCommandLines(task.commandLines);
      setTranscriptionProgressMessage(task.progressMessage);
      setTranscriptionProgressPercent(task.progressPercent);
      setIsGenerating(task.status === "running" || task.status === "canceling");
      setIsCancelingGeneration(task.status === "canceling");
      setGeneratedSubtitlePath(task.outputPath);
      setGenerationStatus(task.presentation);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleChooseGenerationVideo = async () => {
    try {
      const selectedPath = await desktopApi.selectSubtitleMuxVideoFile();
      if (!selectedPath) return;
      await loadGenerationVideo(selectedPath);
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleDropGenerationVideoPaths = (paths: string[]) => {
    const selectedPath = paths.find((path) => path.trim().length > 0);
    if (!selectedPath) {
      setGenerationStatus({
        tone: "error",
        message: "拖放没有读取到视频文件，请重新拖入或使用选择视频",
      });
      return;
    }
    void loadGenerationVideo(selectedPath);
  };

  const useSubtitleTranslationPath = (path: string) => {
    subtitleTranslationSessionRef.current!.selectFile(path);
  };

  const handleChooseSubtitleTranslationFile = async () => {
    try {
      const selectedPath = await desktopApi.selectSubtitleTranslationFile();
      if (!selectedPath) return;
      useSubtitleTranslationPath(selectedPath);
    } catch (error) {
      const wasCancelled = error instanceof DOMException && error.name === "AbortError";
      subtitleTranslationSessionRef.current!.report(
        wasCancelled ? "neutral" : "error",
        wasCancelled
          ? "已停止字幕翻译"
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
  };

  const handleCancelSubtitleTranslation = async () => {
    try {
      await subtitleTranslationSessionRef.current!.cancel();
    } catch {}
  };

  const handleDropSubtitleTranslationPaths = (paths: string[]) => {
    const selectedPath = paths.find((path) => path.trim().length > 0);
    if (!selectedPath) {
      subtitleTranslationSessionRef.current!.report(
        "error",
        "拖放没有读取到字幕文件，请重新拖入或使用选择字幕",
      );
      return;
    }
    useSubtitleTranslationPath(selectedPath);
  };

  const handleChangeGenerationSegment = (
    segmentId: string,
    update: Partial<Pick<SubtitleGenerationSegment, "startMs" | "endMs">>
  ) => {
    if (generationDurationMs === null) {
      setGenerationRangeError("请先等待视频时长读取完成");
      return;
    }
    const result = updateSubtitleGenerationSegment(
      generationSegments,
      segmentId,
      update,
      generationDurationMs
    );
    if (!result.ok) {
      setGenerationRangeError(result.error);
      return;
    }
    setGenerationSegments(result.segments);
    setGenerationRangeError(null);
  };

  const handleAddGenerationMarker = (timeMs: number | null) => {
    if (timeMs === null || generationDurationMs === null) {
      setGenerationRangeError("无法从预览读取当前时间");
      return;
    }
    const segmentId = `segment-${++generationSegmentCounterRef.current}`;
    const result = addSubtitleGenerationMarker(generationSegments, {
      id: segmentId,
      startMs: timeMs,
      durationMs: generationDurationMs,
    });
    if (!result.ok) {
      setGenerationRangeError(result.error);
      return;
    }
    setGenerationSegments(result.segments);
    setActiveGenerationSegmentId(segmentId);
    setGenerationRangeError(null);
  };

  const handleRemoveGenerationSegment = (segmentId: string) => {
    const nextSegments = removeSubtitleGenerationSegment(
      generationSegments,
      segmentId
    );
    setGenerationSegments(nextSegments);
    if (activeGenerationSegmentId === segmentId) {
      setActiveGenerationSegmentId(nextSegments[0]?.id ?? null);
    }
    setGenerationRangeError(null);
  };

  const handleSetGenerationRangeBoundary = (
    boundary: "start" | "end",
    timeMs: number | null
  ) => {
    if (timeMs === null) {
      setGenerationStatus({
        tone: "error",
        message: "无法从预览读取当前时间",
      });
      return;
    }
    const nextMs = Math.round(
      generationDurationMs === null ? timeMs : Math.min(timeMs, generationDurationMs)
    );
    const activeSegment = generationSegments.find(
      ({ id }) => id === activeGenerationSegmentId
    );
    if (boundary === "start" && (!activeSegment || activeSegment.endMs !== null)) {
      handleAddGenerationMarker(nextMs);
      return;
    }
    if (!activeSegment) {
      setGenerationRangeError("请先在视频进度条设为开始");
      return;
    }
    handleChangeGenerationSegment(
      activeSegment.id,
      boundary === "start" ? { startMs: nextMs } : { endMs: nextMs }
    );
  };

  const handleChooseFfmpegBinary = async () => {
    try {
      const selectedPath = await desktopApi.selectFfmpegBinaryFile();
      if (selectedPath) await saveFfmpegPath(selectedPath);
    } catch (error) {
      setMergeStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const saveFasterWhisperPythonPath = async (value: string) => {
    const path = value.trim() || "python3";
    try {
      await desktopApi.configSet(
        "faster_whisper_python_path",
        path === "python3" ? "" : path,
      );
      setFasterWhisperPythonPath(path);
      await refreshFasterWhisperStatus();
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const saveFasterWhisperModelPath = async (value: string) => {
    const path = value.trim();
    try {
      await desktopApi.configSet("faster_whisper_model_path", path);
      setFasterWhisperModelPath(path || null);
      await refreshFasterWhisperStatus();
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const rememberSuccessfulFasterWhisperModel = async () => {
    const nextHistory = addSuccessfulFasterWhisperModel(
      fasterWhisperModelHistory,
      fasterWhisperModelPath,
    );
    if (nextHistory === fasterWhisperModelHistory) return;

    setFasterWhisperModelHistory(nextHistory);
    try {
      await desktopApi.configSet(
        FASTER_WHISPER_MODEL_HISTORY_CONFIG_KEY,
        JSON.stringify(nextHistory),
      );
    } catch {
      // The generated subtitle is still valid when saving the convenience history fails.
    }
  };

  const handleChooseFasterWhisperPython = async () => {
    try {
      const selectedPath = await desktopApi.selectFasterWhisperPythonFile();
      if (!selectedPath) return;
      await saveFasterWhisperPythonPath(selectedPath);
      setGenerationStatus({ tone: "success", message: "Faster Whisper Python 已设置" });
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleChooseFasterWhisperModel = async () => {
    try {
      const selectedPath = await desktopApi.selectFasterWhisperModelDirectory();
      if (!selectedPath) return;
      await saveFasterWhisperModelPath(selectedPath);
      setGenerationStatus({ tone: "success", message: "Faster Whisper CT2 模型已设置" });
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleGenerateSubtitle = async () => {
    if (!generationVideoPath) {
      setGenerationStatus({ tone: "error", message: "请先选择视频文件" });
      return;
    }
    if (fasterWhisperStatus?.available === false) {
      setGenerationStatus({
        tone: "error",
        message: "Faster Whisper 不可用，请确认 Python、faster-whisper 和 CT2 模型目录",
      });
      return;
    }
    if (generationDurationMs === null) {
      setGenerationStatus({ tone: "error", message: "请先等待视频时长读取完成" });
      return;
    }
    const validation = validateSubtitleGenerationSegments(
      generationSegments,
      generationDurationMs
    );
    if (!validation.ok || generationRanges.length === 0) {
      setGenerationStatus({
        tone: "error",
        message:
          (validation.ok ? null : validation.error) ??
          generationRangeError ??
          "请先设置至少一个有效的开始和结束时间",
      });
      return;
    }

    try {
      const result = await desktopApi.transcribeVideoSubtitle({
        videoPath: generationVideoPath,
        ranges: generationRanges,
        durationMs: generationDurationMs,
        language: "ja",
      });
      if (result.completedRanges.length > 0) {
        void rememberSuccessfulFasterWhisperModel();
      }
    } catch (error) {
      // The task session publishes the failure through the same restoration seam.
    }
  };

  const handleCancelGenerateSubtitle = async () => {
    if (!generationVideoPath || !isGenerating) return;
    try {
      await desktopApi.cancelTranscribeVideoSubtitle({
        videoPath: generationVideoPath,
      });
    } catch {
      // The task session keeps the running snapshot and publishes the error.
    }
  };

  const handleTranslateSubtitle = async () => {
    try {
      await subtitleTranslationSessionRef.current!.start();
    } catch {}
  };

  const handleChangeSubtitleTranslationTargetLanguage = (value: string) => {
    subtitleTranslationSessionRef.current!.changeTargetLanguage(value);
  };

  const handleChangeSubtitleTranslationBatchCharacters = (value: number) => {
    subtitleTranslationSessionRef.current!.changeBatchCharacters(value);
  };

  const handleChangeSubtitleTranslationProxyUrl = (value: string) => {
    subtitleTranslationSessionRef.current!.changeProxyUrl(value);
  };

  const handleTestSubtitleTranslationConnection = async () => {
    try {
      await subtitleTranslationSessionRef.current!.testConnection();
    } catch {}
  };

  const handleStart = async () => {
    if (!draft.videoPath || !draft.subtitlePath || !draft.outputPath) {
      setMergeStatus({ tone: "error", message: "请拖入 1 个视频文件和 1 个字幕文件" });
      return;
    }

    if (ffmpegStatus?.available === false) {
      setMergeStatus({
        tone: "error",
        message: "未检测到 ffmpeg，请先安装并确认它在 PATH 中",
      });
      return;
    }

    setIsMerging(true);
    setProgressMessage("准备调用 ffmpeg");
    setMergeStatus({ tone: "neutral", message: "正在合并字幕" });
    try {
      const result = await desktopApi.mergeVideoWithSubtitle({
        videoPath: draft.videoPath,
        subtitlePath: draft.subtitlePath,
        outputPath: draft.outputPath,
      });
      setDraft((current) => ({ ...current, outputPath: result.outputPath }));
      setMergeStatus({ tone: "success", message: `已生成 ${result.outputPath}` });
    } catch (error) {
      setMergeStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleRevealOutput = async () => {
    if (!draft.outputPath) return;
    try {
      await revealInFolder(draft.outputPath);
    } catch (error) {
      setMergeStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleClearGeneration = () => {
    desktopApi.clearCompletedWhisperTranscriptionTask();
    videoPreviewSessionRef.current!.clear();
    setGenerationVideoPath(null);
    setGenerationVideoPreview(null);
    setGenerationDurationMs(null);
    setGenerationSegments([]);
    setActiveGenerationSegmentId(null);
    setGenerationRangeError(null);
    generationSegmentCounterRef.current = 0;
    setGeneratedSubtitlePath(null);
    setTranscriptionProgressMessage(null);
    setTranscriptionProgressPercent(null);
    setTranscriptionCommandLines([]);
    setGenerationStatus({ tone: "neutral", message: null });
  };

  const handleClearTranslation = () => {
    subtitleTranslationSessionRef.current!.clear();
  };

  const handleRevealGeneratedSubtitle = async () => {
    if (!generatedSubtitlePath) return;
    try {
      await revealInFolder(generatedSubtitlePath);
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRevealTranslatedSubtitle = async () => {
    if (!translatedSubtitlePath) return;
    try {
      await revealInFolder(translatedSubtitlePath);
    } catch (error) {
      subtitleTranslationSessionRef.current!.report(
        "error",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  return (
    <div
      className={`flex h-full flex-col overflow-hidden bg-[var(--settings-bg)] ${
        darkMode ? "text-white" : "text-gray-900"
      }`}
    >
      <SubtitleMuxPageContent
        darkMode={darkMode}
        activeTool={activeTool}
        videoPath={draft.videoPath}
        subtitlePath={draft.subtitlePath}
        outputPath={draft.outputPath}
        generationVideoPath={generationVideoPath}
        generationVideoPreview={generationVideoPreview}
        subtitleTranslationPath={subtitleTranslationPath}
        subtitleTranslationTargetLanguage={subtitleTranslationTargetLanguage}
        subtitleTranslationOutputPath={subtitleTranslationOutputPath}
        subtitleTranslationBatchCharacters={subtitleTranslationBatchCharacters}
        subtitleTranslationProxyUrl={subtitleTranslationProxyUrl}
        subtitleTranslationConnectionStatus={subtitleTranslationConnectionStatus}
        subtitleTranslationConnectionError={subtitleTranslationConnectionError}
        subtitleTranslationProgressMessage={subtitleTranslationProgress.message}
        subtitleTranslationProgressPercent={subtitleTranslationProgress.percent}
        generationDurationMs={generationDurationMs}
        generationSegments={generationSegments}
        activeGenerationSegmentId={activeGenerationSegmentId}
        generationRangeError={generationRangeError}
        canStart={canStart}
        isMerging={isMerging}
        isGenerating={isGenerating}
        isTranslatingSubtitle={isTranslatingSubtitle}
        ffmpegStatus={ffmpegStatus}
        ffmpegPath={ffmpegPath}
        fasterWhisperStatus={fasterWhisperStatus}
        fasterWhisperPythonPath={fasterWhisperPythonPath}
        fasterWhisperModelPath={fasterWhisperModelPath}
        fasterWhisperModelHistory={fasterWhisperModelHistory}
        canGenerateSubtitle={canGenerateSubtitle}
        isCancelingGeneration={isCancelingGeneration}
        generatedSubtitlePath={generatedSubtitlePath}
        progressMessage={progressMessage}
        transcriptionProgressMessage={transcriptionProgressMessage}
        transcriptionProgressPercent={transcriptionProgressPercent}
        transcriptionCommandLines={transcriptionCommandLines}
        mergeStatusTone={mergeStatus.tone}
        mergeStatusMessage={mergeStatus.message}
        generationStatusTone={generationStatus.tone}
        generationStatusMessage={generationStatus.message}
        subtitleTranslationStatusTone={subtitleTranslationStatus.tone}
        subtitleTranslationStatusMessage={subtitleTranslationStatus.message}
        onChangeActiveTool={handleChangeActiveTool}
        onDropPaths={handleDropPaths}
        onChooseVideo={() => void handleChoosePath("video")}
        onChooseSubtitle={() => void handleChoosePath("subtitle")}
        onChooseGenerationVideo={() => void handleChooseGenerationVideo()}
        onChooseSubtitleTranslationFile={() =>
          void handleChooseSubtitleTranslationFile()
        }
        onChooseFfmpegBinary={() => void handleChooseFfmpegBinary()}
        onChooseFasterWhisperPython={() =>
          void handleChooseFasterWhisperPython()
        }
        onChooseFasterWhisperModel={() =>
          void handleChooseFasterWhisperModel()
        }
        onChangeFfmpegPath={setFfmpegPath}
        onSaveFfmpegPath={(path) => void saveFfmpegPath(path)}
        onChangeFasterWhisperPythonPath={setFasterWhisperPythonPath}
        onSaveFasterWhisperPythonPath={(path) =>
          void saveFasterWhisperPythonPath(path)
        }
        onChangeFasterWhisperModelPath={(path) =>
          setFasterWhisperModelPath(path || null)
        }
        onSaveFasterWhisperModelPath={(path) =>
          void saveFasterWhisperModelPath(path)
        }
        onChangeSubtitleTranslationTargetLanguage={
          handleChangeSubtitleTranslationTargetLanguage
        }
        onChangeSubtitleTranslationBatchCharacters={
          handleChangeSubtitleTranslationBatchCharacters
        }
        onChangeSubtitleTranslationProxyUrl={handleChangeSubtitleTranslationProxyUrl}
        onTestSubtitleTranslationConnection={handleTestSubtitleTranslationConnection}
        onCancelSubtitleTranslation={handleCancelSubtitleTranslation}
        onUseGenerationVideoPath={(path) => void loadGenerationVideo(path)}
        onUseSubtitleTranslationPath={useSubtitleTranslationPath}
        onDropGenerationVideoPaths={handleDropGenerationVideoPaths}
        onDropSubtitleTranslationPaths={handleDropSubtitleTranslationPaths}
        onSelectGenerationSegment={(segmentId) => {
          setActiveGenerationSegmentId(segmentId);
          setGenerationRangeError(null);
        }}
        onRemoveGenerationSegment={handleRemoveGenerationSegment}
        onSetGenerationRangeStart={(timeMs) =>
          handleSetGenerationRangeBoundary("start", timeMs)
        }
        onSetGenerationRangeEnd={(timeMs) =>
          handleSetGenerationRangeBoundary("end", timeMs)
        }
        onGenerateSubtitle={() => void handleGenerateSubtitle()}
        onCancelGenerateSubtitle={() => void handleCancelGenerateSubtitle()}
        onTranslateSubtitle={() => void handleTranslateSubtitle()}
        onRevealGeneratedSubtitle={() => void handleRevealGeneratedSubtitle()}
        onRevealTranslatedSubtitle={() => void handleRevealTranslatedSubtitle()}
        onRefreshFfmpegStatus={() => void refreshFfmpegStatus()}
        onRefreshFasterWhisperStatus={() => void refreshFasterWhisperStatus()}
        onStart={() => void handleStart()}
        onClear={() => {
          setDraft(EMPTY_DRAFT);
          setProgressMessage(null);
          setMergeStatus({ tone: "neutral", message: null });
        }}
        onClearGeneration={handleClearGeneration}
        onClearTranslation={handleClearTranslation}
        onRevealOutput={() => void handleRevealOutput()}
      />
    </div>
  );
};
