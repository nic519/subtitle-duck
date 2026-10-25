import { StatusMessage, ToolbarButton } from "@/components/page-ui";
import { Combine, FolderOpen } from "lucide-react";
import { FfmpegInstaller } from "./FfmpegInstaller";
import { SubtitleMergeDropzone } from "./SubtitleMergeDropzone";
import type {
  SubtitleMuxPageContentProps,
  SubtitleToolId,
} from "./subtitleMuxPageTypes";
import { MuxDiagnostics, WorkflowStep } from "./SubtitleWorkflow";

type Props = Pick<
  SubtitleMuxPageContentProps,
  | "darkMode"
  | "activeTool"
  | "videoPath"
  | "subtitlePath"
  | "outputPath"
  | "canStart"
  | "isMerging"
  | "ffmpegStatus"
  | "progressMessage"
  | "muxDiagnostics"
  | "mergeStatusTone"
  | "mergeStatusMessage"
  | "onDropPaths"
  | "onChooseVideo"
  | "onChooseSubtitle"
  | "onRefreshFfmpegStatus"
  | "onStart"
  | "onClear"
  | "onRevealOutput"
>;

/** 视频字幕合并输入与结果，只依赖所属工作流的数据和动作。 */
export function SubtitleMergePanel({
  darkMode,
  activeTool,
  videoPath,
  subtitlePath,
  outputPath,
  canStart,
  isMerging,
  ffmpegStatus,
  progressMessage,
  muxDiagnostics,
  mergeStatusTone,
  mergeStatusMessage,
  onDropPaths,
  onChooseVideo,
  onChooseSubtitle,
  onRefreshFfmpegStatus,
  onStart,
  onClear,
  onRevealOutput,
}: Props) {
  const ffmpegUnavailable = ffmpegStatus?.available === false;

  const canClearMerge = Boolean(
    videoPath ||
    subtitlePath ||
    outputPath ||
    progressMessage ||
    mergeStatusMessage,
  );

  const getPanelState = (toolId: SubtitleToolId) =>
    activeTool === toolId ? "active" : "inactive";
  return (
    <>
      <section
        id="subtitle-tool-panel-merge"
        role="tabpanel"
        aria-labelledby="subtitle-tool-tab-merge"
        data-subtitle-tool-panel="merge"
        data-subtitle-tool-panel-state={getPanelState("merge")}
        hidden={activeTool !== "merge"}
        className="mx-auto w-full max-w-[900px] min-w-0"
      >
        <div className="grid gap-4">
          <p className="text-[length:var(--font-size-caption)] leading-relaxed text-muted-foreground">
            <strong className="font-medium text-foreground">软合并：</strong>
            将字幕作为独立轨道嵌入视频；MP4＋SRT 默认保留 MP4，其他组合输出 MKV。音视频无需重编码，可在支持的播放器中选择或关闭字幕。
          </p>
          <div className="flex justify-end gap-2">
            <ToolbarButton
              darkMode={darkMode}
              onClick={onClear}
              disabled={!canClearMerge || isMerging}
              className="bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            >
              清空
            </ToolbarButton>
            <ToolbarButton
              darkMode={darkMode}
              onClick={() => void onStart()}
              className="subtitle-accent-action shrink-0"
              disabled={!canStart || isMerging || ffmpegUnavailable}
            >
              <Combine className="size-3.5" aria-hidden="true" />
              {isMerging ? "正在软合并" : "开始软合并"}
            </ToolbarButton>
          </div>
          <WorkflowStep
            workflow="merge"
            id="files"
            number="01"
            title="导入文件"
            state={videoPath && subtitlePath ? "complete" : "current"}
            isLast={false}
          >
            <SubtitleMergeDropzone
              darkMode={darkMode}
              videoPath={videoPath}
              subtitlePath={subtitlePath}
              disabled={isMerging}
              onDropPaths={onDropPaths}
              onChooseVideo={onChooseVideo}
              onChooseSubtitle={onChooseSubtitle}
            />

            {ffmpegUnavailable ? (
              <FfmpegInstaller
                darkMode={darkMode}
                onRefresh={onRefreshFfmpegStatus}
              />
            ) : null}
          </WorkflowStep>
          <WorkflowStep
            workflow="merge"
            id="output"
            number="02"
            title={mergeStatusTone === "success" ? "软合并完成" : "软合并输出"}
            state={
              mergeStatusTone === "success"
                ? "complete"
                : videoPath && subtitlePath
                  ? "current"
                  : "upcoming"
            }
            isLast
            titleAccessory={
              <div className="flex min-w-0 flex-1 basis-60 flex-wrap items-center gap-x-3 gap-y-2">
                <div
                  data-subtitle-mux-output-path="true"
                  className="min-w-0 flex-1 basis-40 break-all text-[length:var(--font-size-caption)] font-normal text-muted-foreground"
                >
                  {outputPath ?? "等待视频路径"}
                </div>
                {mergeStatusTone === "success" && outputPath ? (
                  <ToolbarButton
                    darkMode={darkMode}
                    onClick={() => void onRevealOutput()}
                    disabled={isMerging}
                    className="ml-auto shrink-0"
                  >
                    <FolderOpen className="size-3.5" aria-hidden="true" />
                    打开文件夹
                  </ToolbarButton>
                ) : null}
              </div>
            }
          >
            {/* 完成后仅保留标题、路径和操作；进度与成功提示不再重复占行。 */}
            {isMerging && (progressMessage || mergeStatusMessage) ? (
              <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
                {progressMessage || mergeStatusMessage}
              </div>
            ) : mergeStatusTone === "error" && mergeStatusMessage ? (
              <StatusMessage tone="error">{mergeStatusMessage}</StatusMessage>
            ) : mergeStatusTone === "neutral" && mergeStatusMessage ? (
              <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
                {mergeStatusMessage}
              </div>
            ) : null}
          </WorkflowStep>
          <MuxDiagnostics report={muxDiagnostics} />
        </div>
      </section>
    </>
  );
}
