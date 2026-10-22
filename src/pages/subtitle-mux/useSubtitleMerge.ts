import { useEffect, useMemo, useState } from "react";
import { desktopApi } from "../../desktop/client";
import {
  mergeSubtitleMuxDraftWithDropPaths,
  type SubtitleMuxDraft,
} from "../../subtitle-mux/subtitleMuxModel";
import { revealInFolder } from "../../utils/fileUtils";
import type { SubtitleMuxPageContentProps } from "./subtitleMuxPageTypes";
const EMPTY_DRAFT: SubtitleMuxDraft = {
  videoPath: null,
  subtitlePath: null,
  outputPath: null,
  error: null,
};
type FfmpegStatus = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};
/** 封装合并任务及 FFmpeg 配置；订阅随页面挂载，切换工具不丢失状态。 */
export function useSubtitleMerge() {
  const [draft, setDraft] = useState<SubtitleMuxDraft>(EMPTY_DRAFT);

  const [isMerging, setIsMerging] = useState(false);

  const [mergeStatus, setMergeStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string | null;
  }>({ tone: "neutral", message: null });

  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);

  const [ffmpegPath, setFfmpegPath] = useState("ffmpeg");

  // 保留最近一次实际执行记录，切换文件后仍可回查；下一次执行时重置。
  const [muxDiagnostics, setMuxDiagnostics] = useState<string | null>(null);

  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const canStart = useMemo(
    () =>
      Boolean(
        draft.videoPath &&
        draft.subtitlePath &&
        draft.outputPath &&
        !draft.error &&
        ffmpegStatus?.available !== false,
      ),
    [draft, ffmpegStatus],
  );

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

  const refreshFfmpegStatus = async () => {
    const status = await desktopApi.getFfmpegStatus();
    setFfmpegStatus(status);
    // 应用内安装完成后同步实际路径，避免手动配置框仍显示旧值。
    if (status.available && status.path) setFfmpegPath(status.path);
    return status;
  };

  const saveFfmpegPath = async (value: string) => {
    const path = value.trim() || "ffmpeg";
    try {
      await desktopApi.configSet(
        "ffmpeg_binary_path",
        path === "ffmpeg" ? "" : path,
      );
      setFfmpegPath(path);
      await refreshFfmpegStatus();
    } catch (error) {
      setMergeStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  useEffect(() => {
    return desktopApi.onSubtitleMuxProgress((progress) => {
      setProgressMessage(progress.message);
      if (progress.diagnostics) setMuxDiagnostics(progress.diagnostics);
    });
  }, []);

  const handleDropPaths = (paths: string[]) => {
    const nextDraft = mergeSubtitleMuxDraftWithDropPaths(draft, paths);
    setDraft(nextDraft);
    setProgressMessage(null);
    setMergeStatus(
      nextDraft.error
        ? { tone: "error", message: nextDraft.error }
        : { tone: "neutral", message: "已选择视频和字幕，准备合并" },
    );
  };

  const handleChoosePath = async (kind: "video" | "subtitle") => {
    try {
      const selectedPath =
        kind === "video"
          ? await desktopApi.selectSubtitleMuxVideoFile()
          : await desktopApi.selectSubtitleMuxSubtitleFile();
      if (!selectedPath) return;
      const nextDraft = mergeSubtitleMuxDraftWithDropPaths(draft, [
        selectedPath,
      ]);
      setDraft(nextDraft);
      setProgressMessage(null);
      setMergeStatus(
        nextDraft.error
          ? { tone: "error", message: nextDraft.error }
          : { tone: "neutral", message: "已选择视频和字幕，准备合并" },
      );
    } catch (error) {
      setMergeStatus({
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

  const handleStart = async () => {
    if (!draft.videoPath || !draft.subtitlePath || !draft.outputPath) {
      setMergeStatus({
        tone: "error",
        message: "请拖入 1 个视频文件和 1 个字幕文件",
      });
      return;
    }

    if (ffmpegStatus?.available === false) {
      setMergeStatus({
        tone: "error",
        message: "未检测到 ffmpeg，请先安装并确认它在 PATH 中",
      });
      return;
    }

    setMuxDiagnostics(null);
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
      setMergeStatus({
        tone: "success",
        message: `已生成 ${result.outputPath}`,
      });
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
  return {
    videoPath: draft.videoPath,
    subtitlePath: draft.subtitlePath,
    outputPath: draft.outputPath,
    canStart: canStart,
    isMerging: isMerging,
    ffmpegStatus: ffmpegStatus,
    ffmpegPath: ffmpegPath,
    progressMessage: progressMessage,
    muxDiagnostics: muxDiagnostics,
    mergeStatusTone: mergeStatus.tone,
    mergeStatusMessage: mergeStatus.message,
    onDropPaths: handleDropPaths,
    onChooseVideo: () => void handleChoosePath("video"),
    onChooseSubtitle: () => void handleChoosePath("subtitle"),
    onChooseFfmpegBinary: () => void handleChooseFfmpegBinary(),
    onChangeFfmpegPath: setFfmpegPath,
    onSaveFfmpegPath: (path) => void saveFfmpegPath(path),
    onRefreshFfmpegStatus: () => void refreshFfmpegStatus(),
    onStart: () => void handleStart(),
    onClear: () => {
      setDraft(EMPTY_DRAFT);
      setProgressMessage(null);
      setMergeStatus({ tone: "neutral", message: null });
    },
    onRevealOutput: () => void handleRevealOutput(),
  } satisfies Partial<SubtitleMuxPageContentProps>;
}
