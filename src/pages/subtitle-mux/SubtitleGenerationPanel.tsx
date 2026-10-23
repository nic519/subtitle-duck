import { FilePathPicker } from "@/components/file-path-picker/FilePathPicker";
import {
  StatusMessage,
  ToolbarButton,
  ToolbarIconButton,
} from "@/components/page-ui";
import { Toast, ToastDescription } from "@/components/ui/toast";
import { VideoInfo } from "@/components/video-info/VideoInfo";
import { Combine, FolderOpen, Video } from "lucide-react";
import { useState } from "react";
import { FfmpegInstaller } from "./FfmpegInstaller";
import { ManagedWhisperPanel } from "./ManagedWhisperPanel";
import { SubtitleFileMergePanel } from "./SubtitleFileMergePanel";
import { SubtitleGenerationBatchList } from "./SubtitleGenerationBatchList";
import { SubtitleGenerationSegmentEditor } from "./SubtitleGenerationSegmentEditor";
import type {
  SubtitleMuxPageContentProps,
  SubtitleToolId,
} from "./subtitleMuxPageTypes";
import {
  getWorkflowStepStates,
  isSubtitleGenerationVideoPath,
  TranscriptionCommands,
  WorkflowStep,
} from "./SubtitleWorkflow";
import { useVideoPreviewPlayback } from "./useVideoPreviewPlayback";

type Props = Pick<
  SubtitleMuxPageContentProps,
  | "darkMode"
  | "activeTool"
  | "generationBatch"
  | "onRemoveBatchVideo"
  | "onRevealBatchSubtitle"
  | "generationVideoPath"
  | "generationVideoPreview"
  | "generationDurationMs"
  | "generationSegments"
  | "activeGenerationSegmentId"
  | "generationRangeError"
  | "canGenerateSubtitle"
  | "isGenerating"
  | "isCancelingGeneration"
  | "ffmpegStatus"
  | "fasterWhisperStatus"
  | "fasterWhisperPythonPath"
  | "fasterWhisperModelPath"
  | "fasterWhisperModelHistory"
  | "generatedSubtitlePath"
  | "transcriptionProgressMessage"
  | "transcriptionProgressPercent"
  | "transcriptionCommandLines"
  | "generationStatusTone"
  | "generationStatusMessage"
  | "onChooseGenerationVideo"
  | "onChooseFasterWhisperPython"
  | "onChooseFasterWhisperModel"
  | "onChangeFasterWhisperPythonPath"
  | "onSaveFasterWhisperPythonPath"
  | "onChangeFasterWhisperModelPath"
  | "onSaveFasterWhisperModelPath"
  | "onUseGenerationVideoPath"
  | "onDropGenerationVideoPaths"
  | "onSelectGenerationSegment"
  | "onRemoveGenerationSegment"
  | "onSetGenerationRangeStart"
  | "onSetGenerationRangeEnd"
  | "onGenerateSubtitle"
  | "onCancelGenerateSubtitle"
  | "onRevealGeneratedSubtitle"
  | "onRefreshFfmpegStatus"
  | "onRefreshFasterWhisperStatus"
  | "onClearGeneration"
>;

/** 生成流程与预览交互，只依赖所属工作流的数据和动作。 */
export function SubtitleGenerationPanel({
  darkMode,
  activeTool,
  generationBatch,
  onRemoveBatchVideo,
  onRevealBatchSubtitle,
  generationVideoPath,
  generationVideoPreview,
  generationDurationMs,
  generationSegments,
  activeGenerationSegmentId,
  generationRangeError,
  canGenerateSubtitle,
  isGenerating,
  isCancelingGeneration,
  ffmpegStatus,
  fasterWhisperStatus,
  fasterWhisperPythonPath,
  fasterWhisperModelPath,
  fasterWhisperModelHistory,
  generatedSubtitlePath,
  transcriptionProgressMessage,
  transcriptionProgressPercent,
  transcriptionCommandLines,
  generationStatusTone,
  generationStatusMessage,
  onChooseGenerationVideo,
  onChooseFasterWhisperPython,
  onChooseFasterWhisperModel,
  onChangeFasterWhisperPythonPath,
  onSaveFasterWhisperPythonPath,
  onChangeFasterWhisperModelPath,
  onSaveFasterWhisperModelPath,
  onUseGenerationVideoPath,
  onDropGenerationVideoPaths,
  onSelectGenerationSegment,
  onRemoveGenerationSegment,
  onSetGenerationRangeStart,
  onSetGenerationRangeEnd,
  onGenerateSubtitle,
  onCancelGenerateSubtitle,
  onRevealGeneratedSubtitle,
  onRefreshFfmpegStatus,
  onRefreshFasterWhisperStatus,
  onClearGeneration,
}: Props) {
  const [managedWhisperLog, setManagedWhisperLog] = useState("");

  const [whisperReady, setWhisperReady] = useState<boolean | null>(null);

  const hasGenerationBatch = generationBatch.items.length > 0;

  const previewPlayback = useVideoPreviewPlayback(generationVideoPreview);

  const [generationDropNotice, setGenerationDropNotice] = useState<
    string | null
  >(null);

  const ffmpegUnavailable = ffmpegStatus?.available === false;

  const fasterWhisperUnavailable = fasterWhisperStatus?.available === false;

  const hasGenerationVideo = Boolean(generationVideoPath) || hasGenerationBatch;

  const generationIsComplete = hasGenerationBatch
    ? generationBatch.items.every((item) => item.status === "completed")
    : Boolean(generatedSubtitlePath) &&
      generationStatusTone === "success" &&
      !isGenerating;

  const generationStepStates = getWorkflowStepStates({
    hasInput: hasGenerationVideo,
    isComplete: generationIsComplete,
  });

  const canClearGeneration = Boolean(
    hasGenerationBatch ||
    generationVideoPath ||
    generationVideoPreview ||
    generationDurationMs !== null ||
    generationSegments.length > 0 ||
    activeGenerationSegmentId ||
    generationRangeError ||
    generatedSubtitlePath ||
    transcriptionProgressMessage ||
    transcriptionProgressPercent !== null ||
    transcriptionCommandLines.length > 0 ||
    generationStatusMessage,
  );

  const getPanelState = (toolId: SubtitleToolId) =>
    activeTool === toolId ? "active" : "inactive";
  return (
    <>
      <section
        id="subtitle-tool-panel-generate"
        role="tabpanel"
        aria-labelledby="subtitle-tool-tab-generate"
        data-subtitle-tool-panel="generate"
        data-subtitle-tool-panel-state={getPanelState("generate")}
        hidden={activeTool !== "generate"}
        className="min-w-0"
      >
        <div
          data-subtitle-generation-workflow="true"
          className="relative mx-auto grid w-full max-w-[900px] gap-0 px-1"
        >
          <div className="flex justify-end gap-2">
            <ToolbarButton
              darkMode={darkMode}
              onClick={onClearGeneration}
              disabled={!canClearGeneration || isGenerating}
              className="bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            >
              清空
            </ToolbarButton>
            {isGenerating ? (
              <ToolbarButton
                darkMode={darkMode}
                onClick={() => void onCancelGenerateSubtitle()}
                disabled={isCancelingGeneration}
              >
                {isCancelingGeneration ? "正在停止" : "停止任务"}
              </ToolbarButton>
            ) : null}
            <ToolbarButton
              darkMode={darkMode}
              onClick={() => void onGenerateSubtitle()}
              className="subtitle-accent-action shrink-0"
              disabled={
                !canGenerateSubtitle || isGenerating || fasterWhisperUnavailable
              }
            >
              {isGenerating && transcriptionProgressMessage
                ? "正在生成字幕"
                : hasGenerationBatch
                  ? "批量生成字幕"
                  : "生成字幕"}
            </ToolbarButton>
          </div>
          <WorkflowStep
            workflow="generation"
            id="file"
            number="01"
            title="选择视频"
            state={generationStepStates.file}
            isLast={false}
          >
            <div className="min-w-0">
              <FilePathPicker
                id="subtitle-generate-video"
                compact
                darkMode={darkMode}
                label="视频"
                icon={<Video className="size-4 shrink-0" />}
                selectedPath={generationVideoPath}
                selectedPathDataAttribute={{
                  "data-subtitle-generate-selected-path": "video",
                }}
                placeholder="拖入一个或多个视频，或粘贴本地路径"
                dropTitle="拖入视频文件"
                chooseLabel="选择视频"
                showHeader={false}
                disabled={isGenerating}
                onChoose={onChooseGenerationVideo}
                onUsePath={onUseGenerationVideoPath}
                onDropPaths={(paths) => {
                  const videoPaths = paths.filter(
                    isSubtitleGenerationVideoPath,
                  );
                  if (videoPaths.length === 0) {
                    setGenerationDropNotice("仅支持拖入视频文件");
                    return;
                  }
                  onDropGenerationVideoPaths(videoPaths);
                }}
              />
              <div className="mt-3">
                {hasGenerationBatch ? (
                  <SubtitleGenerationBatchList
                    batch={generationBatch}
                    darkMode={darkMode}
                    onRemove={onRemoveBatchVideo}
                    onReveal={onRevealBatchSubtitle}
                  />
                ) : (
                  <VideoInfo videoPath={generationVideoPath} />
                )}
              </div>
            </div>
          </WorkflowStep>

          <WorkflowStep
            workflow="generation"
            id="settings"
            number="02"
            title="Faster Whisper"
            titleAccessory={
              <span
                className={`ml-auto text-[length:var(--font-size-caption)] ${whisperReady ? "text-[var(--status-success-text)]" : "text-muted-foreground"}`}
              >
                {whisperReady === null
                  ? "检测中"
                  : whisperReady
                    ? "已就绪"
                    : "待安装"}
              </span>
            }
            state={generationStepStates.settings}
            isLast={false}
          >
            <div
              data-subtitle-generate-whisper-card="compact"
              data-subtitle-transcription-engine="faster-whisper"
              className="grid min-w-0 content-start gap-2"
            >
              <details className="min-w-0 text-[length:var(--font-size-caption)]">
                <summary className="cursor-pointer text-muted-foreground">
                  手动配置
                </summary>
                {fasterWhisperStatus?.error && (
                  <p className="my-2 break-words text-muted-foreground">
                    {fasterWhisperStatus.error}
                  </p>
                )}
                <div className="grid min-w-0 gap-x-4 gap-y-2 lg:grid-cols-2 text-[length:var(--font-size-caption)]">
                  <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2">
                    <span className="whitespace-nowrap text-muted-foreground">
                      运行环境
                    </span>
                    <span
                      data-subtitle-tool-faster-whisper-python-path
                      title={fasterWhisperPythonPath ?? "python3"}
                    >
                      <input
                        value={fasterWhisperPythonPath ?? "python3"}
                        onChange={(event) =>
                          onChangeFasterWhisperPythonPath(event.target.value)
                        }
                        onBlur={(event) =>
                          void onSaveFasterWhisperPythonPath(event.target.value)
                        }
                        disabled={isGenerating}
                        spellCheck={false}
                        aria-label="Faster Whisper Python 路径"
                        className="h-7 w-full min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2 font-mono text-[11px] text-foreground outline-none focus:border-[var(--control-accent)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
                      />
                    </span>
                    <ToolbarIconButton
                      darkMode={darkMode}
                      onClick={() => void onChooseFasterWhisperPython()}
                      disabled={isGenerating}
                      aria-label="选择 Python"
                      title="选择 Python"
                      className="h-7 w-7"
                    >
                      <FolderOpen className="size-3.5" />
                    </ToolbarIconButton>
                  </div>
                  <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2">
                    <span className="whitespace-nowrap text-muted-foreground">
                      识别模型
                    </span>
                    <span
                      data-subtitle-tool-faster-whisper-model-path
                      title={
                        fasterWhisperModelHistory.length > 0
                          ? "可从下拉列表快速切换已成功使用的模型"
                          : (fasterWhisperModelPath ?? undefined)
                      }
                    >
                      <input
                        value={fasterWhisperModelPath ?? ""}
                        onChange={(event) =>
                          onChangeFasterWhisperModelPath(event.target.value)
                        }
                        onBlur={(event) =>
                          void onSaveFasterWhisperModelPath(event.target.value)
                        }
                        disabled={isGenerating}
                        placeholder="选择或粘贴 CT2 模型目录"
                        list="faster-whisper-successful-models"
                        spellCheck={false}
                        aria-label="Faster Whisper CT2 模型目录"
                        className="h-7 w-full min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2 font-mono text-[11px] text-foreground outline-none placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
                      />
                      <datalist id="faster-whisper-successful-models">
                        {fasterWhisperModelHistory.map((modelPath) => (
                          <option key={modelPath} value={modelPath}>
                            已成功使用
                          </option>
                        ))}
                      </datalist>
                    </span>
                    <ToolbarIconButton
                      darkMode={darkMode}
                      onClick={() => void onChooseFasterWhisperModel()}
                      disabled={isGenerating}
                      aria-label="选择 CT2 模型目录"
                      title="选择 CT2 模型目录"
                      className="h-7 w-7"
                    >
                      <FolderOpen className="size-3.5" />
                    </ToolbarIconButton>
                  </div>
                </div>
              </details>
            </div>
            {ffmpegUnavailable ? (
              <FfmpegInstaller
                darkMode={darkMode}
                onRefresh={onRefreshFfmpegStatus}
              />
            ) : null}

            <ManagedWhisperPanel
              darkMode={darkMode}
              disabled={isGenerating}
              currentModel={fasterWhisperModelPath}
              onUseModel={onSaveFasterWhisperModelPath}
              onLogChanged={setManagedWhisperLog}
              onReadinessChanged={setWhisperReady}
              onEnvironmentChanged={async (path) => {
                await onChangeFasterWhisperPythonPath(path);
                await onRefreshFasterWhisperStatus();
              }}
            />
          </WorkflowStep>

          {!hasGenerationBatch ? (
            <WorkflowStep
              workflow="generation"
              id="progress"
              number="03"
              title="截取与生成"
              state={generationStepStates.progress}
              isLast
            >
              <div className="grid gap-2.5">
                <p className="text-[length:var(--font-size-caption)] text-muted-foreground">
                  选择片段或识别全片，字幕另存为 SRT。
                </p>

                <div className="grid gap-2.5">
                  {generationVideoPreview && !previewPlayback.isUnavailable ? (
                    <video
                      ref={previewPlayback.videoRef}
                      data-subtitle-generate-preview="true"
                      src={previewPlayback.sourceUrl}
                      hidden={isGenerating || Boolean(generatedSubtitlePath)}
                      className="aspect-video mx-auto w-full max-w-[720px] rounded-[8px] bg-black"
                      onTimeUpdate={(event) =>
                        previewPlayback.reportTime(
                          event.currentTarget.currentTime,
                        )
                      }
                      onPlay={() => previewPlayback.reportPlaying(true)}
                      onPause={() => previewPlayback.reportPlaying(false)}
                      onEnded={() => previewPlayback.reportPlaying(false)}
                      onError={previewPlayback.reportNativeError}
                      onLoadedData={(event) => {
                        // Some containers load audio even when their video codec is unsupported.
                        if (
                          generationVideoPreview.adapter === "native" &&
                          event.currentTarget.videoWidth === 0
                        ) {
                          previewPlayback.reportNativeError();
                        }
                      }}
                    />
                  ) : !isGenerating && generationVideoPath ? (
                    <div className="rounded-[8px] bg-[var(--result-surface)] px-3 py-4 text-[length:var(--font-size-caption)] text-muted-foreground">
                      {previewPlayback.error
                        ? `实时兼容预览失败：${previewPlayback.error}`
                        : "正在建立兼容预览…"}
                    </div>
                  ) : null}

                  <SubtitleGenerationSegmentEditor
                    durationMs={generationDurationMs ?? 0}
                    playheadMs={previewPlayback.playheadMs}
                    isPlaying={previewPlayback.isPlaying}
                    segments={generationSegments}
                    activeSegmentId={activeGenerationSegmentId}
                    disabled={isGenerating || !generationVideoPath}
                    error={generationRangeError}
                    onSelectSegment={onSelectGenerationSegment}
                    onRemoveSegment={onRemoveGenerationSegment}
                    onSeek={previewPlayback.seek}
                    onTogglePlayback={previewPlayback.toggle}
                    onSetStartFromPlayhead={() =>
                      onSetGenerationRangeStart(previewPlayback.playheadMs)
                    }
                    onSetEndFromPlayhead={() =>
                      onSetGenerationRangeEnd(previewPlayback.playheadMs)
                    }
                  />
                </div>

                {transcriptionProgressMessage ? (
                  <div className="border-l-2 border-[var(--subtitle-accent-border)] pl-3 text-[length:var(--font-size-caption)] text-muted-foreground">
                    {transcriptionProgressMessage}
                  </div>
                ) : null}

                {transcriptionCommandLines.length > 0 ? (
                  <TranscriptionCommands commands={transcriptionCommandLines} />
                ) : null}

                {generatedSubtitlePath ? (
                  <div
                    data-subtitle-tool-generated-subtitle-path
                    className="break-all text-[length:var(--font-size-caption)] text-foreground"
                  >
                    {generatedSubtitlePath}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {generatedSubtitlePath ? (
                    <ToolbarButton
                      darkMode={darkMode}
                      onClick={() => void onRevealGeneratedSubtitle()}
                      disabled={isGenerating}
                    >
                      打开字幕
                    </ToolbarButton>
                  ) : null}
                </div>
              </div>

              {generationStatusMessage && generationStatusTone === "neutral" ? (
                <div className="mt-3 text-[length:var(--font-size-caption)] text-muted-foreground">
                  {generationStatusMessage}
                </div>
              ) : generationStatusMessage ? (
                <div className="mt-3">
                  <StatusMessage tone={generationStatusTone}>
                    {generationStatusMessage}
                  </StatusMessage>
                </div>
              ) : null}
            </WorkflowStep>
          ) : generationStatusTone === "error" && generationStatusMessage ? (
            <StatusMessage tone="error">
              {generationStatusMessage}
            </StatusMessage>
          ) : null}
          <section
            aria-labelledby="subtitle-file-merge-title"
            className="mt-6 min-w-0 border-t border-[var(--form-field-border)] pt-5"
          >
            <h3
              id="subtitle-file-merge-title"
              className="mb-3 flex items-center gap-2 text-sm font-semibold"
            >
              <Combine className="size-4" />
              字幕合并
            </h3>
            <SubtitleFileMergePanel
              darkMode={darkMode}
              generatedSubtitlePath={generatedSubtitlePath}
            />
          </section>
          <div className="mt-4 text-[length:var(--font-size-caption)] text-muted-foreground">
            {managedWhisperLog && (
              <details className="mt-3">
                <summary className="cursor-pointer">安装与下载日志</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px]">
                  {managedWhisperLog}
                </pre>
              </details>
            )}
          </div>
        </div>
      </section>
      <Toast
        open={Boolean(generationDropNotice)}
        onOpenChange={(open) => {
          if (!open) setGenerationDropNotice(null);
        }}
      >
        <ToastDescription>{generationDropNotice}</ToastDescription>
      </Toast>
    </>
  );
}
