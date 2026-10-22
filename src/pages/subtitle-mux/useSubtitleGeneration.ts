import { useEffect, useMemo, useRef, useState } from "react";
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
  createVideoPreviewSession,
  type VideoPreviewSource,
} from "../../subtitle-mux/videoPreviewSession";
import { revealInFolder } from "../../utils/fileUtils";
import type { SubtitleMuxPageContentProps } from "./subtitleMuxPageTypes";
import { useFasterWhisperSettings } from "./useFasterWhisperSettings";
/** 封装生成任务、预览及模型配置；订阅随页面挂载，切换工具不丢失状态。 */
export function useSubtitleGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);

  const [isCancelingGeneration, setIsCancelingGeneration] = useState(false);

  const [generationStatus, setGenerationStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string | null;
  }>({ tone: "neutral", message: null });

  const { config, rememberSuccessfulFasterWhisperModel } =
    useFasterWhisperSettings(setGenerationStatus);
  const { fasterWhisperStatus } = config;

  const [generationBatch, setGenerationBatch] = useState(
    desktopApi.subtitleGenerationBatch.getSnapshot,
  );

  useEffect(
    () => desktopApi.subtitleGenerationBatch.subscribe(setGenerationBatch),
    [],
  );

  const hasGenerationBatch = generationBatch.items.length > 0;

  const [generationVideoPath, setGenerationVideoPath] = useState<string | null>(
    null,
  );

  const [generationVideoPreview, setGenerationVideoPreview] =
    useState<VideoPreviewSource | null>(null);

  const [generationDurationMs, setGenerationDurationMs] = useState<
    number | null
  >(null);

  const [generationSegments, setGenerationSegments] = useState<
    SubtitleGenerationSegment[]
  >([]);

  const [activeGenerationSegmentId, setActiveGenerationSegmentId] = useState<
    string | null
  >(null);

  const [generationRangeError, setGenerationRangeError] = useState<
    string | null
  >(null);

  const [transcriptionProgressMessage, setTranscriptionProgressMessage] =
    useState<string | null>(null);

  const [transcriptionProgressPercent, setTranscriptionProgressPercent] =
    useState<number | null>(null);

  const [transcriptionCommandLines, setTranscriptionCommandLines] = useState<
    string[]
  >([]);

  const [generatedSubtitlePath, setGeneratedSubtitlePath] = useState<
    string | null
  >(null);

  const generationSegmentCounterRef = useRef(0);

  const videoPreviewSessionRef = useRef<ReturnType<
    typeof createVideoPreviewSession
  > | null>(null);

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

  const generationRanges = useMemo(
    () => getValidSubtitleGenerationRanges(generationSegments),
    [generationSegments],
  );

  const canGenerateSubtitle = hasGenerationBatch
    ? !generationBatch.running &&
      generationBatch.items.some((item) => item.status !== "completed") &&
      fasterWhisperStatus?.available !== false
    : Boolean(
        generationVideoPath &&
        generationDurationMs !== null &&
        generationRanges.length > 0 &&
        !generationRangeError &&
        fasterWhisperStatus?.available !== false,
      );

  useEffect(
    () =>
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
    [],
  );

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
      if (preview.videoPath !== trimmedPath || preview.durationMs === null)
        return;
      const initialSegmentId = `segment-${++generationSegmentCounterRef.current}`;
      setGenerationSegments(
        createInitialSubtitleGenerationSegments(
          preview.durationMs,
          initialSegmentId,
        ),
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
      // 批量有独立的列表状态，不能让其中一个任务覆盖单视频的预览与片段。
      if (desktopApi.subtitleGenerationBatch.getSnapshot().items.length > 0)
        return;
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
      if (desktopApi.subtitleGenerationBatch.getSnapshot().items.length > 0) {
        desktopApi.subtitleGenerationBatch.add([selectedPath]);
      } else {
        await loadGenerationVideo(selectedPath);
      }
    } catch (error) {
      setGenerationStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleDropGenerationVideoPaths = (paths: string[]) => {
    if (
      isGenerating ||
      desktopApi.subtitleGenerationBatch.getSnapshot().running
    )
      return;
    const videoPaths = [
      ...new Set(
        paths
          .map((path) => path.trim())
          .filter((path) => /\.(mp4|mkv|avi|mov|wmv|m4v|ts|webm)$/i.test(path)),
      ),
    ];
    if (videoPaths.length === 0) {
      setGenerationStatus({
        tone: "error",
        message: "拖放没有读取到视频文件，请重新拖入或使用选择视频",
      });
      return;
    }
    const existing = desktopApi.subtitleGenerationBatch.getSnapshot();
    const combined = [
      ...new Set([
        ...(generationVideoPath ? [generationVideoPath] : []),
        ...videoPaths,
      ]),
    ];
    if (existing.items.length > 0 || combined.length > 1) {
      desktopApi.subtitleGenerationBatch.add(combined);
      videoPreviewSessionRef.current!.clear();
      setGenerationStatus({ tone: "neutral", message: null });
    } else {
      void loadGenerationVideo(videoPaths[0]);
    }
  };

  const handleChangeGenerationSegment = (
    segmentId: string,
    update: Partial<Pick<SubtitleGenerationSegment, "startMs" | "endMs">>,
  ) => {
    if (generationDurationMs === null) {
      setGenerationRangeError("请先等待视频时长读取完成");
      return;
    }
    const result = updateSubtitleGenerationSegment(
      generationSegments,
      segmentId,
      update,
      generationDurationMs,
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
      segmentId,
    );
    setGenerationSegments(nextSegments);
    if (activeGenerationSegmentId === segmentId) {
      setActiveGenerationSegmentId(nextSegments[0]?.id ?? null);
    }
    setGenerationRangeError(null);
  };

  const handleSetGenerationRangeBoundary = (
    boundary: "start" | "end",
    timeMs: number | null,
  ) => {
    if (timeMs === null) {
      setGenerationStatus({
        tone: "error",
        message: "无法从预览读取当前时间",
      });
      return;
    }
    const nextMs = Math.round(
      generationDurationMs === null
        ? timeMs
        : Math.min(timeMs, generationDurationMs),
    );
    const activeSegment = generationSegments.find(
      ({ id }) => id === activeGenerationSegmentId,
    );
    if (
      boundary === "start" &&
      (!activeSegment || activeSegment.endMs !== null)
    ) {
      handleAddGenerationMarker(nextMs);
      return;
    }
    if (!activeSegment) {
      setGenerationRangeError("请先在视频进度条设为开始");
      return;
    }
    handleChangeGenerationSegment(
      activeSegment.id,
      boundary === "start" ? { startMs: nextMs } : { endMs: nextMs },
    );
  };

  const handleGenerateSubtitle = async () => {
    if (
      isGenerating ||
      desktopApi.subtitleGenerationBatch.getSnapshot().running
    )
      return;
    if (hasGenerationBatch) {
      if (fasterWhisperStatus?.available === false) return;
      await desktopApi.subtitleGenerationBatch.start();
      if (
        desktopApi.subtitleGenerationBatch
          .getSnapshot()
          .items.some((item) => item.status === "completed")
      ) {
        void rememberSuccessfulFasterWhisperModel();
      }
      return;
    }
    if (!generationVideoPath) {
      setGenerationStatus({ tone: "error", message: "请先选择视频文件" });
      return;
    }
    if (fasterWhisperStatus?.available === false) {
      setGenerationStatus({
        tone: "error",
        message:
          "Faster Whisper 不可用，请确认 Python、faster-whisper 和 CT2 模型目录",
      });
      return;
    }
    if (generationDurationMs === null) {
      setGenerationStatus({
        tone: "error",
        message: "请先等待视频时长读取完成",
      });
      return;
    }
    const validation = validateSubtitleGenerationSegments(
      generationSegments,
      generationDurationMs,
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
        language: "auto",
      });
      if (result.completedRanges.length > 0) {
        void rememberSuccessfulFasterWhisperModel();
      }
    } catch (error) {
      // The task session publishes the failure through the same restoration seam.
    }
  };

  const handleCancelGenerateSubtitle = async () => {
    if (desktopApi.subtitleGenerationBatch.getSnapshot().running) {
      try {
        await desktopApi.subtitleGenerationBatch.cancel();
      } catch (error) {
        setGenerationStatus({
          tone: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
    if (!generationVideoPath || !isGenerating) return;
    try {
      await desktopApi.cancelTranscribeVideoSubtitle({
        videoPath: generationVideoPath,
      });
    } catch {
      // The task session keeps the running snapshot and publishes the error.
    }
  };

  const handleClearGeneration = () => {
    if (
      isGenerating ||
      desktopApi.subtitleGenerationBatch.getSnapshot().running
    )
      return;
    desktopApi.subtitleGenerationBatch.clear();
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
  return {
    ...config,
    onRemoveBatchVideo: (path) =>
      desktopApi.subtitleGenerationBatch.remove(path),
    generationBatch: generationBatch,
    onRevealBatchSubtitle: async (path) => {
      try {
        await revealInFolder(path);
      } catch (error) {
        setGenerationStatus({
          tone: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    generationVideoPath: generationVideoPath,
    generationVideoPreview: generationVideoPreview,
    generationDurationMs: generationDurationMs,
    generationSegments: generationSegments,
    activeGenerationSegmentId: activeGenerationSegmentId,
    generationRangeError: generationRangeError,
    isGenerating: isGenerating || generationBatch.running,
    canGenerateSubtitle: canGenerateSubtitle,
    isCancelingGeneration: isCancelingGeneration || generationBatch.canceling,
    generatedSubtitlePath: generatedSubtitlePath,
    transcriptionProgressMessage: transcriptionProgressMessage,
    transcriptionProgressPercent: hasGenerationBatch
      ? Math.round(
          generationBatch.items.reduce(
            (sum, item) =>
              sum + (item.status === "completed" ? 100 : (item.percent ?? 0)),
            0,
          ) / generationBatch.items.length,
        )
      : transcriptionProgressPercent,
    transcriptionCommandLines: transcriptionCommandLines,
    generationStatusTone: generationStatus.tone,
    generationStatusMessage: generationStatus.message,
    onChooseGenerationVideo: () => void handleChooseGenerationVideo(),
    onUseGenerationVideoPath: (path) =>
      hasGenerationBatch
        ? handleDropGenerationVideoPaths([path])
        : void loadGenerationVideo(path),
    onDropGenerationVideoPaths: handleDropGenerationVideoPaths,
    onSelectGenerationSegment: (segmentId) => {
      setActiveGenerationSegmentId(segmentId);
      setGenerationRangeError(null);
    },
    onRemoveGenerationSegment: handleRemoveGenerationSegment,
    onSetGenerationRangeStart: (timeMs) =>
      handleSetGenerationRangeBoundary("start", timeMs),
    onSetGenerationRangeEnd: (timeMs) =>
      handleSetGenerationRangeBoundary("end", timeMs),
    onGenerateSubtitle: () => void handleGenerateSubtitle(),
    onCancelGenerateSubtitle: () => void handleCancelGenerateSubtitle(),
    onRevealGeneratedSubtitle: () => void handleRevealGeneratedSubtitle(),
    onClearGeneration: handleClearGeneration,
  } satisfies Partial<SubtitleMuxPageContentProps>;
}
