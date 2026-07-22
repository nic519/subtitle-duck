import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { desktopApi } from "../../desktop/client";
import { getSettingsPageBackgroundClassName } from "../../theme/appleTheme";
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
  formatSubtitleRangeTime,
} from "../../subtitle-mux/subtitleGenerationRange";
import {
  mergeSubtitleMuxDraftWithDropPaths,
  type SubtitleMuxDraft,
} from "../../subtitle-mux/subtitleMuxModel";
import { buildSubtitleTranslationOutputPath } from "../../subtitle-mux/subtitleTranslation";
import {
  addSuccessfulFasterWhisperModel,
  parseFasterWhisperModelHistory,
} from "../../subtitle-mux/fasterWhisperModelHistory";
import {
  updateSubtitleTranslationUiState,
  type SubtitleTranslationUiAction,
} from "../../subtitle-mux/subtitleTranslationUiState";
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

const formatGenerationRange = (range: {
  startMs: number;
  endMs: number;
}): string =>
  `${formatSubtitleRangeTime(range.startMs)}–${formatSubtitleRangeTime(range.endMs)}`;

type FfmpegStatus = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};

type WhisperStatus = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};

type WhisperCoreMlStatus = {
  available: boolean;
  expectedPath: string | null;
  installedPath: string | null;
  error: string | null;
};

type SubtitleTranscriptionEngine = "whisper.cpp" | "faster-whisper";

type FasterWhisperStatus = WhisperStatus;

interface SubtitleMuxPageProps {
  initialActiveTool?: SubtitleToolId;
}

export const SubtitleMuxPage = ({
  initialActiveTool = "merge",
}: SubtitleMuxPageProps) => {
  const { darkMode } = useTheme();
  const pageBackgroundClassName = getSettingsPageBackgroundClassName(darkMode);
  const [draft, setDraft] = useState<SubtitleMuxDraft>(EMPTY_DRAFT);
  const [isMerging, setIsMerging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslatingSubtitle, setIsTranslatingSubtitle] = useState(false);
  const [isCancelingGeneration, setIsCancelingGeneration] = useState(false);
  const [mergeStatus, setMergeStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string | null;
  }>({ tone: "neutral", message: null });
  const [generationStatus, setGenerationStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string | null;
  }>({ tone: "neutral", message: null });
  const [subtitleTranslationStatus, setSubtitleTranslationStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string | null;
  }>({ tone: "neutral", message: null });
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);
  const [ffmpegPath, setFfmpegPath] = useState("ffmpeg");
  const [whisperStatus, setWhisperStatus] = useState<WhisperStatus | null>(null);
  const [whisperBinaryPath, setWhisperBinaryPath] = useState("whisper-cli");
  const [fasterWhisperStatus, setFasterWhisperStatus] =
    useState<FasterWhisperStatus | null>(null);
  const [whisperCoreMlStatus, setWhisperCoreMlStatus] =
    useState<WhisperCoreMlStatus | null>(null);
  const [isAppleSilicon, setIsAppleSilicon] = useState(false);
  const [whisperModelPath, setWhisperModelPath] = useState<string | null>(null);
  const [transcriptionEngine, setTranscriptionEngine] =
    useState<SubtitleTranscriptionEngine>("faster-whisper");
  const [fasterWhisperPythonPath, setFasterWhisperPythonPath] =
    useState<string | null>("python3");
  const [fasterWhisperModelPath, setFasterWhisperModelPath] =
    useState<string | null>(null);
  const [fasterWhisperModelHistory, setFasterWhisperModelHistory] = useState<
    string[]
  >([]);
  const [activeTool, setActiveTool] =
    useState<SubtitleToolId>(initialActiveTool);
  const [generationLanguage, setGenerationLanguage] = useState("auto");
  const [subtitleTranslationTargetLanguage, setSubtitleTranslationTargetLanguage] =
    useState("zh-CN");
  const [
    subtitleTranslationBatchCharacters,
    setSubtitleTranslationBatchCharacters,
  ] = useState(1500);
  const [subtitleTranslationProxyUrl, setSubtitleTranslationProxyUrl] = useState("");
  const [subtitleTranslationConnectionStatus, setSubtitleTranslationConnectionStatus] = useState<"idle" | "testing" | "available" | "unavailable">("idle");
  const [subtitleTranslationConnectionError, setSubtitleTranslationConnectionError] = useState<string | null>(null);
  const [subtitleTranslationPath, setSubtitleTranslationPath] =
    useState<string | null>(null);
  const [translatedSubtitlePath, setTranslatedSubtitlePath] =
    useState<string | null>(null);
  const [subtitleTranslationProgress, setSubtitleTranslationProgress] =
    useState<{
      message: string | null;
      percent: number | null;
    }>({ message: null, percent: null });
  const [generationVideoPath, setGenerationVideoPath] = useState<string | null>(null);
  const [generationVideoPreviewUrl, setGenerationVideoPreviewUrl] =
    useState<string | null>(null);
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
  const generationVideoLoadIdRef = useRef<string | null>(null);
  const generationSegmentCounterRef = useRef(0);

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
      (transcriptionEngine === "faster-whisper"
        ? fasterWhisperStatus?.available !== false
        : whisperStatus?.available !== false)
  );
  const subtitleTranslationOutputPath = subtitleTranslationPath
    ? buildSubtitleTranslationOutputPath(
        subtitleTranslationPath,
        subtitleTranslationTargetLanguage
      )
    : translatedSubtitlePath;

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

  useEffect(() => {
    void Promise.all([
      desktopApi.configGet("whisper_binary_path"),
      desktopApi.getWhisperStatus(),
    ])
      .then(([path, status]) => {
        setWhisperBinaryPath(path?.trim() || "whisper-cli");
        setWhisperStatus(status);
      })
      .catch((error) => {
        setWhisperStatus({
          available: false,
          path: "whisper-cli",
          version: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, []);

  useEffect(() => {
    void desktopApi
      .getRuntimeEnvironment()
      .then((environment) => {
        setIsAppleSilicon(environment.isAppleSilicon);
      })
      .catch(() => {
        setIsAppleSilicon(false);
      });
  }, []);

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

  const refreshWhisperStatus = async () => {
    const status = await desktopApi.getWhisperStatus();
    setWhisperStatus(status);
    return status;
  };

  const saveWhisperBinaryPath = async (value: string) => {
    const path = value.trim() || "whisper-cli";
    try {
      await desktopApi.configSet(
        "whisper_binary_path",
        path === "whisper-cli" ? "" : path,
      );
      setWhisperBinaryPath(path);
      await refreshWhisperStatus();
    } catch (error) {
      setGenerationStatus({
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
        setTranscriptionEngine("faster-whisper");
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
    void desktopApi
      .configGet("whisper_model_path")
      .then((value) => {
        const modelPath = value?.trim() || null;
        setWhisperModelPath(modelPath);
        return desktopApi.getWhisperCoreMlStatus(modelPath);
      })
      .then(setWhisperCoreMlStatus)
      .catch(() => {
        setWhisperModelPath(null);
        setWhisperCoreMlStatus(null);
      });
  }, []);

  useEffect(() => {
    void desktopApi.configGet("subtitle_translation_proxy_url").then((value) => {
      setSubtitleTranslationProxyUrl(value?.trim() || "");
    });
  }, []);

  useEffect(() => {
    if (activeTool !== "translate") return;
    let disposed = false;
    setSubtitleTranslationConnectionStatus("testing");
    setSubtitleTranslationConnectionError(null);
    void desktopApi.testSubtitleTranslationConnection().then(
      (result) => {
        if (disposed) return;
        setSubtitleTranslationConnectionStatus(result.available ? "available" : "unavailable");
        setSubtitleTranslationConnectionError(result.error);
      },
      (error) => {
        if (disposed) return;
        setSubtitleTranslationConnectionStatus("unavailable");
        setSubtitleTranslationConnectionError(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      disposed = true;
    };
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
    const loadId = crypto.randomUUID();
    generationVideoLoadIdRef.current = loadId;

    setGenerationVideoPath(trimmedPath);
    setGenerationVideoPreviewUrl(null);
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
      const [{ durationMs }, { url }] = await Promise.all([
        desktopApi.getWhisperVideoDuration(trimmedPath),
        desktopApi.getLocalVideoPreviewUrl(trimmedPath),
      ]);
      if (generationVideoLoadIdRef.current !== loadId) return;
      const initialSegmentId = `segment-${++generationSegmentCounterRef.current}`;
      setGenerationVideoPreviewUrl(url);
      setGenerationDurationMs(durationMs);
      setGenerationSegments(
        createInitialSubtitleGenerationSegments(durationMs, initialSegmentId)
      );
      setActiveGenerationSegmentId(initialSegmentId);
      setGenerationStatus({ tone: "neutral", message: null });

      void desktopApi
        .getCompatibleVideoPreviewUrl(trimmedPath)
        .then((preview) => {
          if (generationVideoLoadIdRef.current !== loadId) return;
          setGenerationVideoPreviewUrl(preview.url);
          setGenerationStatus({ tone: "neutral", message: null });
        })
        .catch((previewError) => {
          if (generationVideoLoadIdRef.current !== loadId) return;
          setGenerationStatus({
            tone: "error",
            message: `兼容预览生成失败：${
              previewError instanceof Error
                ? previewError.message
                : String(previewError)
            }`,
          });
        });
    } catch (error) {
      if (generationVideoLoadIdRef.current !== loadId) return;
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  useEffect(() => {
    const task = desktopApi.getWhisperTranscriptionTask();
    if (!task) return;

    const { input, progress } = task;
    const restoredSegments = input.ranges.map((range, index) => ({
      id: `segment-${index + 1}`,
      startMs: range.startMs,
      endMs: range.endMs,
    }));
    let disposed = false;

    generationVideoLoadIdRef.current = `restored-${crypto.randomUUID()}`;
    setGenerationVideoPath(input.videoPath);
    setGenerationDurationMs(input.durationMs);
    setGenerationSegments(restoredSegments);
    setActiveGenerationSegmentId(restoredSegments[0]?.id ?? null);
    setGenerationRangeError(null);
    generationSegmentCounterRef.current = restoredSegments.length;
    setGenerationVideoPreviewUrl(null);
    setTranscriptionCommandLines(task.commandLines);
    setTranscriptionProgressMessage(
      progress?.message ??
        (task.status === "running" ? "正在生成字幕" : null)
    );
    setTranscriptionProgressPercent(
      progress?.phase === "transcribing" && typeof progress.percent === "number"
        ? progress.percent
        : progress?.phase === "completed"
          ? 100
          : null
    );

    if (task.status === "running") {
      setIsGenerating(true);
      setIsCancelingGeneration(false);
      setGeneratedSubtitlePath(null);
      setGenerationStatus({ tone: "neutral", message: "正在生成字幕" });
    } else if (task.status === "completed") {
      const summary =
        progress?.message ??
        (task.result.outputPath
          ? `已生成 ${task.result.outputPath}`
          : "没有生成字幕");
      setIsGenerating(false);
      setIsCancelingGeneration(false);
      setGeneratedSubtitlePath(task.result.outputPath);
      setGenerationStatus({
        tone: task.result.outputPath && !task.result.stopped && task.result.failedRanges.length === 0
          ? "success"
          : task.result.outputPath
            ? "neutral"
            : "error",
        message: summary,
      });
    } else {
      setIsGenerating(false);
      setIsCancelingGeneration(false);
      setGeneratedSubtitlePath(null);
      setGenerationStatus({ tone: "error", message: task.error });
    }

    void desktopApi
      .getLocalVideoPreviewUrl(input.videoPath)
      .then(({ url }) => {
        if (!disposed) setGenerationVideoPreviewUrl(url);
      })
      .catch(() => undefined);
    void desktopApi
      .getCompatibleVideoPreviewUrl(input.videoPath)
      .then((preview) => {
        if (!disposed) setGenerationVideoPreviewUrl(preview.url);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() =>
    desktopApi.onWhisperTranscriptionTaskChange((task) => {
      if (!task) return;

      const { progress } = task;
      setTranscriptionCommandLines(task.commandLines);
      setTranscriptionProgressMessage(
        progress?.message ??
          (task.status === "running" ? "正在生成字幕" : null)
      );
      setTranscriptionProgressPercent(
        progress?.phase === "transcribing" && typeof progress.percent === "number"
          ? progress.percent
          : progress?.phase === "completed"
            ? 100
            : null
      );

      if (task.status === "running") {
        setIsGenerating(true);
        setIsCancelingGeneration(false);
        setGenerationStatus({ tone: "neutral", message: "正在生成字幕" });
        return;
      }

      setIsGenerating(false);
      setIsCancelingGeneration(false);
      if (task.status === "completed") {
        const summary =
          progress?.message ??
          (task.result.outputPath
            ? `已生成 ${task.result.outputPath}`
            : "没有生成字幕");
        setGeneratedSubtitlePath(task.result.outputPath);
        setGenerationStatus({
          tone:
            task.result.outputPath &&
            !task.result.stopped &&
            task.result.failedRanges.length === 0
              ? "success"
              : task.result.outputPath
                ? "neutral"
                : "error",
          message: summary,
        });
        return;
      }

      setGeneratedSubtitlePath(null);
      setGenerationStatus({ tone: "error", message: task.error });
    }),
  []);

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
    const trimmedPath = path.trim();
    if (!trimmedPath) return;
    if (!/\.srt$/i.test(trimmedPath)) {
      setSubtitleTranslationStatus({
        tone: "error",
        message: "只支持 .srt 字幕文件",
      });
      return;
    }
    setSubtitleTranslationPath(trimmedPath);
    setTranslatedSubtitlePath(null);
    setSubtitleTranslationProgress({ message: null, percent: null });
    setSubtitleTranslationStatus({
      tone: "neutral",
      message: "已选择字幕，准备翻译",
    });
  };

  const handleChooseSubtitleTranslationFile = async () => {
    try {
      const selectedPath = await desktopApi.selectSubtitleTranslationFile();
      if (!selectedPath) return;
      useSubtitleTranslationPath(selectedPath);
    } catch (error) {
      const wasCancelled = error instanceof DOMException && error.name === "AbortError";
      setSubtitleTranslationStatus({
        tone: wasCancelled ? "neutral" : "error",
        message: wasCancelled
          ? "已停止字幕翻译"
          : error instanceof Error
            ? error.message
            : String(error),
      });
    }
  };

  const handleCancelSubtitleTranslation = async () => {
    if (!subtitleTranslationPath || !isTranslatingSubtitle) return;
    setSubtitleTranslationStatus({ tone: "neutral", message: "正在停止翻译" });
    try {
      await desktopApi.cancelTranslateSubtitleFile({ subtitlePath: subtitleTranslationPath });
    } catch (error) {
      setSubtitleTranslationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleDropSubtitleTranslationPaths = (paths: string[]) => {
    const selectedPath = paths.find((path) => path.trim().length > 0);
    if (!selectedPath) {
      setSubtitleTranslationStatus({
        tone: "error",
        message: "拖放没有读取到字幕文件，请重新拖入或使用选择字幕",
      });
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

  const handleChooseWhisperModel = async () => {
    try {
      const selectedPath = await desktopApi.selectWhisperModelFile();
      if (!selectedPath) return;
      await desktopApi.configSet("whisper_model_path", selectedPath);
      setWhisperModelPath(selectedPath);
      await refreshWhisperStatus();
      setWhisperCoreMlStatus(await desktopApi.getWhisperCoreMlStatus(selectedPath));
      setGenerationStatus({ tone: "success", message: "whisper 模型已设置" });
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
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

  const handleChooseWhisperBinary = async () => {
    try {
      const selectedPath = await desktopApi.selectWhisperBinaryFile();
      if (selectedPath) await saveWhisperBinaryPath(selectedPath);
    } catch (error) {
      setGenerationStatus({
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

  const handleChooseWhisperCoreMlPackage = async () => {
    if (!whisperModelPath) {
      setGenerationStatus({
        tone: "error",
        message: "请先选择 whisper 模型文件",
      });
      return;
    }

    try {
      const selectedPath = await desktopApi.selectWhisperCoreMlPackageFile();
      if (!selectedPath) return;
      setGenerationStatus({ tone: "neutral", message: "正在安装 Core ML 加速包" });
      const status = await desktopApi.installWhisperCoreMlPackage({
        packagePath: selectedPath,
        modelPath: whisperModelPath,
      });
      setWhisperCoreMlStatus(status);
      setGenerationStatus({
        tone: status.available ? "success" : "error",
        message: status.available
          ? "Core ML 加速包已安装"
          : status.error ?? "Core ML 加速包安装失败",
      });
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
    const activeStatus =
      transcriptionEngine === "faster-whisper"
        ? fasterWhisperStatus
        : whisperStatus;
    if (activeStatus?.available === false) {
      setGenerationStatus({
        tone: "error",
        message:
          transcriptionEngine === "faster-whisper"
            ? "Faster Whisper 不可用，请确认 Python、faster-whisper 和 CT2 模型目录"
            : "whisper.cpp 不可用，请在字幕生成工具中选择模型并确认 whisper-cli 可用",
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

    setIsGenerating(true);
    setIsCancelingGeneration(false);
    setGeneratedSubtitlePath(null);
    setTranscriptionProgressMessage("准备生成字幕");
    setTranscriptionProgressPercent(0);
    setTranscriptionCommandLines([]);
    setGenerationStatus({ tone: "neutral", message: "正在生成字幕" });
    try {
      const result = await desktopApi.transcribeVideoSubtitle(
        {
          videoPath: generationVideoPath,
          ranges: generationRanges,
          durationMs: generationDurationMs,
          language:
            transcriptionEngine === "faster-whisper" ? "ja" : generationLanguage,
        },
        (progress) => {
          setTranscriptionProgressMessage(progress.message);
          setTranscriptionProgressPercent(
            progress.phase === "transcribing" && typeof progress.percent === "number"
              ? progress.percent
              : progress.phase === "completed"
                ? 100
                : null
          );
          if (progress.phase === "command") {
            setTranscriptionCommandLines((current) =>
              current.includes(progress.command)
                ? current
                : [...current, progress.command]
            );
          }
        }
      );
      if (
        transcriptionEngine === "faster-whisper" &&
        result.completedRanges.length > 0
      ) {
        void rememberSuccessfulFasterWhisperModel();
      }
      setGeneratedSubtitlePath(result.outputPath);
      const failedDetails = result.failedRanges
        .map(({ range, error }) => `${formatGenerationRange(range)}：${error}`)
        .join("；");
      const stoppedSummary = result.stopped
        ? [
            "字幕生成已停止",
            result.completedRanges.length > 0
              ? `已完成 ${result.completedRanges.length} 个（${result.completedRanges.map(formatGenerationRange).join("、")}）`
              : "已完成 0 个",
            result.failedRanges.length > 0
              ? `失败 ${result.failedRanges.length} 个（${failedDetails}）`
              : null,
            result.interruptedRange
              ? `中断 ${formatGenerationRange(result.interruptedRange)}`
              : null,
            result.pendingRanges.length > 0
              ? `未处理 ${result.pendingRanges.length} 个（${result.pendingRanges.map(formatGenerationRange).join("、")}）`
              : null,
          ]
            .filter(Boolean)
            .join("；")
        : null;
      if (result.outputPath) {
        const summary = result.stopped
          ? stoppedSummary!
          : result.failedRanges.length > 0
            ? `已生成 ${result.outputPath}；成功 ${result.completedRanges.length} 个片段，失败 ${result.failedRanges.length} 个片段${failedDetails ? `（${failedDetails}）` : ""}`
            : `已生成 ${result.outputPath}`;
        setTranscriptionProgressMessage(summary);
        setGenerationStatus({
          tone:
            result.stopped || result.failedRanges.length > 0
              ? "neutral"
              : "success",
          message: summary,
        });
      } else {
        const summary = result.stopped
          ? stoppedSummary!
          : `没有生成字幕；失败 ${result.failedRanges.length} 个片段${failedDetails ? `（${failedDetails}）` : ""}`;
        setTranscriptionProgressMessage(summary);
        setGenerationStatus({
          tone: result.stopped ? "neutral" : "error",
          message: summary,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "字幕生成已停止") {
        setTranscriptionProgressMessage("字幕生成已停止");
        setGenerationStatus({ tone: "neutral", message });
        return;
      }
      setGenerationStatus({
        tone: "error",
        message,
      });
    } finally {
      setIsGenerating(false);
      setIsCancelingGeneration(false);
    }
  };

  const handleCancelGenerateSubtitle = async () => {
    if (!generationVideoPath || !isGenerating) return;
    setIsCancelingGeneration(true);
    setTranscriptionProgressMessage("正在停止字幕生成");
    setGenerationStatus({ tone: "neutral", message: "正在停止字幕生成" });
    try {
      await desktopApi.cancelTranscribeVideoSubtitle({
        videoPath: generationVideoPath,
      });
    } catch (error) {
      setIsCancelingGeneration(false);
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleTranslateSubtitle = async () => {
    if (!subtitleTranslationPath) {
      setSubtitleTranslationStatus({ tone: "error", message: "请先选择 SRT 字幕文件" });
      return;
    }

    setIsTranslatingSubtitle(true);
    setSubtitleTranslationProgress({ message: "准备翻译字幕", percent: 0 });
    setSubtitleTranslationStatus({ tone: "neutral", message: "正在翻译字幕" });
    try {
      const result = await desktopApi.translateSubtitleFile(
        {
          subtitlePath: subtitleTranslationPath,
          targetLanguage: subtitleTranslationTargetLanguage,
          sourceLanguage: "auto",
          maxBatchCharacters: subtitleTranslationBatchCharacters,
        },
        (progress) => {
          setSubtitleTranslationProgress({
            message: progress.message,
            percent:
              progress.totalCueCount > 0
                ? (progress.completedCueCount / progress.totalCueCount) * 100
                : 100,
          });
        }
      );
      setTranslatedSubtitlePath(result.outputPath);
      setSubtitleTranslationProgress((current) => ({
        message: current.message ?? "字幕翻译完成",
        percent: 100,
      }));
      setSubtitleTranslationStatus({
        tone: "success",
        message: `已翻译 ${result.cueCount} 条字幕`,
      });
    } catch (error) {
      setSubtitleTranslationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      setSubtitleTranslationProgress({ message: null, percent: null });
    } finally {
      setIsTranslatingSubtitle(false);
    }
  };

  const applySubtitleTranslationSettingsAction = (
    action: SubtitleTranslationUiAction,
  ) => {
    const next = updateSubtitleTranslationUiState(
      {
        targetLanguage: subtitleTranslationTargetLanguage,
        batchCharacters: subtitleTranslationBatchCharacters,
        translatedSubtitlePath,
        progress: subtitleTranslationProgress,
        status: subtitleTranslationStatus,
      },
      action,
    );
    setSubtitleTranslationTargetLanguage(next.targetLanguage);
    setSubtitleTranslationBatchCharacters(next.batchCharacters);
    setTranslatedSubtitlePath(next.translatedSubtitlePath);
    setSubtitleTranslationProgress(next.progress);
    setSubtitleTranslationStatus(next.status);
  };

  const handleChangeSubtitleTranslationTargetLanguage = (value: string) => {
    applySubtitleTranslationSettingsAction({
      type: "changeTargetLanguage",
      value,
    });
  };

  const handleChangeSubtitleTranslationBatchCharacters = (value: number) => {
    applySubtitleTranslationSettingsAction({
      type: "changeBatchCharacters",
      value,
    });
  };

  const handleChangeSubtitleTranslationProxyUrl = (value: string) => {
    setSubtitleTranslationProxyUrl(value);
    void desktopApi.configSet("subtitle_translation_proxy_url", value.trim());
  };

  const handleTestSubtitleTranslationConnection = async () => {
    setSubtitleTranslationConnectionStatus("testing");
    setSubtitleTranslationConnectionError(null);
    try {
      const result = await desktopApi.testSubtitleTranslationConnection(subtitleTranslationProxyUrl);
      setSubtitleTranslationConnectionStatus(result.available ? "available" : "unavailable");
      setSubtitleTranslationConnectionError(result.error);
    } catch (error) {
      setSubtitleTranslationConnectionStatus("unavailable");
      setSubtitleTranslationConnectionError(error instanceof Error ? error.message : String(error));
    }
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
    generationVideoLoadIdRef.current = crypto.randomUUID();
    setGenerationVideoPath(null);
    setGenerationVideoPreviewUrl(null);
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
    setSubtitleTranslationPath(null);
    setTranslatedSubtitlePath(null);
    setSubtitleTranslationProgress({ message: null, percent: null });
    setSubtitleTranslationStatus({ tone: "neutral", message: null });
    setSubtitleTranslationConnectionStatus("idle");
    setSubtitleTranslationConnectionError(null);
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
      setSubtitleTranslationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div
      className={`flex h-full flex-col overflow-hidden ${pageBackgroundClassName} ${
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
        generationVideoPreviewUrl={generationVideoPreviewUrl}
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
        transcriptionEngine={transcriptionEngine}
        whisperStatus={whisperStatus}
        whisperBinaryPath={whisperBinaryPath}
        fasterWhisperStatus={fasterWhisperStatus}
        whisperCoreMlStatus={whisperCoreMlStatus}
        isAppleSilicon={isAppleSilicon}
        whisperModelPath={whisperModelPath}
        fasterWhisperPythonPath={fasterWhisperPythonPath}
        fasterWhisperModelPath={fasterWhisperModelPath}
        fasterWhisperModelHistory={fasterWhisperModelHistory}
        generationLanguage={generationLanguage}
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
        onChooseWhisperModel={() => void handleChooseWhisperModel()}
        onChooseFfmpegBinary={() => void handleChooseFfmpegBinary()}
        onChooseWhisperBinary={() => void handleChooseWhisperBinary()}
        onChooseFasterWhisperPython={() =>
          void handleChooseFasterWhisperPython()
        }
        onChooseFasterWhisperModel={() =>
          void handleChooseFasterWhisperModel()
        }
        onChooseWhisperCoreMlPackage={() =>
          void handleChooseWhisperCoreMlPackage()
        }
        onChangeFfmpegPath={setFfmpegPath}
        onSaveFfmpegPath={(path) => void saveFfmpegPath(path)}
        onChangeWhisperBinaryPath={setWhisperBinaryPath}
        onSaveWhisperBinaryPath={(path) => void saveWhisperBinaryPath(path)}
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
        onChangeGenerationLanguage={setGenerationLanguage}
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
        onRefreshWhisperStatus={() => void refreshWhisperStatus()}
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
