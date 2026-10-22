import { FfmpegInstaller } from "./FfmpegInstaller";
import { ManagedWhisperPanel } from "./ManagedWhisperPanel";
import { SubtitleFileMergePanel } from "./SubtitleFileMergePanel";
import type { SubtitleGenerationBatchSnapshot } from "../../subtitle-mux/subtitleGenerationBatch";
import { SubtitleGenerationBatchList } from "./SubtitleGenerationBatchList";
import {
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Captions,
  ChevronRight,
  CircleCheck,
  CircleX,
  Combine,
  Copy,
  FolderOpen,
  Languages,
  LoaderCircle,
  RefreshCw,
  Terminal,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  FixedRailLayout,
  StatusMessage,
  ToolbarButton,
  ToolbarIconButton,
} from "@/components/page-ui";
import { Separator } from "@/components/ui/separator";
import { FilePathPicker } from "@/components/file-path-picker/FilePathPicker";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastViewport,
} from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Popover as PopoverPrimitive } from "radix-ui";
import type { SubtitleGenerationSegment } from "../../subtitle-mux/subtitleGenerationSegments";
import type { VideoPreviewSource } from "../../subtitle-mux/videoPreviewSession";
import { VideoInfo } from "@/components/video-info/VideoInfo";
import { SubtitleGenerationSegmentEditor } from "./SubtitleGenerationSegmentEditor";
import { SubtitleMergeDropzone } from "./SubtitleMergeDropzone";
import { useVideoPreviewPlayback } from "./useVideoPreviewPlayback";

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

const subtitleGenerationVideoExtensions = new Set([
  ".mp4",
  ".m4v",
  ".mov",
  ".mkv",
  ".avi",
  ".webm",
  ".wmv",
  ".ts",
]);

const subtitleDuckIconUrl = new URL(
  "../../../assets/app-icon.png",
  import.meta.url,
).href;

const isSubtitleGenerationVideoPath = (path: string) => {
  const normalizedPath = path.trim().toLowerCase();
  return Array.from(subtitleGenerationVideoExtensions).some((extension) =>
    normalizedPath.endsWith(extension),
  );
};

export type SubtitleMuxPageContentProps = {
  generationBatch: SubtitleGenerationBatchSnapshot;
  onRemoveBatchVideo: (path: string) => void;
  onRevealBatchSubtitle: (path: string) => void | Promise<void>;
  darkMode: boolean;
  activeTool: SubtitleToolId;
  videoPath: string | null;
  subtitlePath: string | null;
  outputPath: string | null;
  generationVideoPath: string | null;
  generationVideoPreview: VideoPreviewSource | null;
  generationDurationMs: number | null;
  generationSegments: SubtitleGenerationSegment[];
  activeGenerationSegmentId: string | null;
  generationRangeError: string | null;
  canStart: boolean;
  canGenerateSubtitle: boolean;
  isMerging: boolean;
  isGenerating: boolean;
  isCancelingGeneration: boolean;
  ffmpegStatus: FfmpegStatus | null;
  ffmpegPath: string;
  fasterWhisperStatus: FasterWhisperStatus | null;
  fasterWhisperPythonPath: string | null;
  fasterWhisperModelPath: string | null;
  fasterWhisperModelHistory: string[];
  generatedSubtitlePath: string | null;
  progressMessage: string | null;
  transcriptionProgressMessage: string | null;
  transcriptionProgressPercent: number | null;
  muxDiagnostics: string | null;
  transcriptionCommandLines: string[];
  mergeStatusTone: "neutral" | "success" | "error";
  mergeStatusMessage: string | null;
  generationStatusTone: "neutral" | "success" | "error";
  generationStatusMessage: string | null;
  subtitleTranslationPath: string | null;
  subtitleTranslationTargetLanguage: string;
  subtitleTranslationOutputPath: string | null;
  subtitleTranslationBatchCharacters: number;
  subtitleTranslationProxyEnabled: boolean;
  onChangeSubtitleTranslationProxyEnabled: (value: boolean) => void;
  subtitleTranslationProxyUrl: string;
  subtitleTranslationConnectionStatus: "idle" | "testing" | "available" | "unavailable";
  subtitleTranslationConnectionError: string | null;
  subtitleTranslationProgressMessage: string | null;
  subtitleTranslationProgressPercent: number | null;
  isTranslatingSubtitle: boolean;
  subtitleTranslationStatusTone: "neutral" | "success" | "error";
  subtitleTranslationStatusMessage: string | null;
  onChangeActiveTool: (toolId: SubtitleToolId) => void;
  onDropPaths: (paths: string[]) => void;
  onChooseVideo: () => void | Promise<void>;
  onChooseSubtitle: () => void | Promise<void>;
  onChooseGenerationVideo: () => void | Promise<void>;
  onChooseSubtitleTranslationFile: () => void | Promise<void>;
  onChooseFfmpegBinary: () => void | Promise<void>;
  onChooseFasterWhisperPython: () => void | Promise<void>;
  onChooseFasterWhisperModel: () => void | Promise<void>;
  onChangeFfmpegPath: (path: string) => void | Promise<void>;
  onSaveFfmpegPath: (path: string) => void | Promise<void>;
  onChangeFasterWhisperPythonPath: (path: string) => void | Promise<void>;
  onSaveFasterWhisperPythonPath: (path: string) => void | Promise<void>;
  onChangeFasterWhisperModelPath: (path: string) => void | Promise<void>;
  onSaveFasterWhisperModelPath: (path: string) => void | Promise<void>;
  onChangeSubtitleTranslationTargetLanguage: (value: string) => void;
  onChangeSubtitleTranslationBatchCharacters: (value: number) => void;
  onChangeSubtitleTranslationProxyUrl: (value: string) => void;
  onTestSubtitleTranslationConnection: () => void;
  onCancelSubtitleTranslation: () => void;
  onUseGenerationVideoPath: (path: string) => void;
  onUseSubtitleTranslationPath: (path: string) => void;
  onDropGenerationVideoPaths: (paths: string[]) => void;
  onDropSubtitleTranslationPaths: (paths: string[]) => void;
  onSelectGenerationSegment: (segmentId: string) => void;
  onRemoveGenerationSegment: (segmentId: string) => void;
  onSetGenerationRangeStart: (timeMs: number | null) => void;
  onSetGenerationRangeEnd: (timeMs: number | null) => void;
  onGenerateSubtitle: () => void | Promise<void>;
  onCancelGenerateSubtitle: () => void | Promise<void>;
  onTranslateSubtitle: () => void | Promise<void>;
  onRevealGeneratedSubtitle: () => void | Promise<void>;
  onRevealTranslatedSubtitle: () => void | Promise<void>;
  onRefreshFfmpegStatus: () => void | Promise<void>;
  onRefreshFasterWhisperStatus: () => void | Promise<void>;
  onStart: () => void | Promise<void>;
  onClear: () => void;
  onClearGeneration: () => void;
  onClearTranslation: () => void;
  onRevealOutput: () => void | Promise<void>;
};

export type SubtitleToolId =
  "merge" | "generate" | "translate";

const subtitleTools: Array<{
  id: SubtitleToolId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "merge", label: "视字合并", icon: Combine },
  { id: "generate", label: "字幕生成", icon: Captions },
  { id: "translate", label: "字幕翻译", icon: Languages },
];

const subtitleTranslationLanguageOptions = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "英语" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" },
];

const getPathTail = (path: string | null): string | null => {
  if (!path) return null;
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
};

const getPathDirectory = (path: string | null): string | null => {
  if (!path) return null;
  const separatorIndex = Math.max(
    path.lastIndexOf("/"),
    path.lastIndexOf("\\"),
  );
  if (separatorIndex < 0) return null;
  if (separatorIndex === 2 && /^[A-Za-z]:[\\/]/.test(path)) {
    return path.slice(0, 3);
  }
  return separatorIndex === 0
    ? path.slice(0, 1)
    : path.slice(0, separatorIndex);
};

type TranslationStepState = "complete" | "current" | "upcoming";

const getWorkflowStepStates = ({
  hasInput,
  isComplete,
}: {
  hasInput: boolean;
  isComplete: boolean;
}) => ({
  file: hasInput ? "complete" : "current",
  settings: hasInput ? "complete" : "upcoming",
  progress: isComplete ? "complete" : hasInput ? "current" : "upcoming",
}) satisfies Record<"file" | "settings" | "progress", TranslationStepState>;

const WorkflowStep = ({
  workflow = "translation",
  id,
  number,
  title,
  titleAccessory,
  state,
  isLast,
  children,
}: {
  workflow?: "translation" | "generation" | "merge";
  id: string;
  number: string;
  title: string;
  titleAccessory?: ReactElement;
  state: TranslationStepState;
  isLast: boolean;
  children: ReactNode;
}) => {
  const markerClassName =
    state === "complete"
      ? "subtitle-accent-marker"
      : state === "current"
        ? "subtitle-accent-current"
        : "border-[var(--result-divider)] bg-[var(--result-surface)] text-muted-foreground";
  const stateLabel =
    state === "complete" ? "完成" : state === "current" ? "当前" : "未开始";

  return (
    <section
      data-subtitle-workflow={workflow}
      data-subtitle-translation-step={workflow === "translation" ? id : undefined}
      data-subtitle-generation-step={workflow === "generation" ? id : undefined}
      data-step-state={state}
      aria-current={state === "current" ? "step" : undefined}
      className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-4"
    >
      <div className="relative flex justify-center">
        <div
          data-subtitle-translation-step-marker-backdrop={workflow === "translation" ? id : undefined}
          data-subtitle-generation-step-marker-backdrop={workflow === "generation" ? id : undefined}
          className="relative z-10 flex size-9 items-center justify-center rounded-full bg-[var(--app-bg)]"
        >
          <div
            data-subtitle-translation-step-marker={workflow === "translation" ? id : undefined}
            data-subtitle-generation-step-marker={workflow === "generation" ? id : undefined}
            className={`flex size-7 items-center justify-center rounded-full border text-[11px] font-bold tracking-tight transition-all duration-300 motion-reduce:transition-none ${markerClassName}`}
            aria-hidden="true"
          >
            {number}
          </div>
        </div>
        {isLast ? null : (
          <Separator
            data-subtitle-translation-step-thread={workflow === "translation" ? id : undefined}
            data-subtitle-generation-step-thread={workflow === "generation" ? id : undefined}
            orientation="vertical"
            className="subtitle-accent-thread absolute bottom-[-28px] top-9 w-px opacity-60"
          />
        )}
      </div>
      <div className={isLast ? "min-w-0" : "min-w-0 pb-6"}>
        <div className={`mb-2 flex min-w-0 items-center gap-2 ${workflow === "merge" && id === "output" ? "flex-wrap" : ""}`}>
          <h3
            data-subtitle-translation-step-title={workflow === "translation" ? id : undefined}
            data-subtitle-generation-step-title={workflow === "generation" ? id : undefined}
            className="shrink-0 text-[length:var(--font-size-control)] font-semibold tracking-[-0.02em] text-foreground"
          >
            {title}
          </h3>
          {titleAccessory}
          <span className="sr-only">（{stateLabel}）</span>
        </div>
        {children}
      </div>
    </section>
  );
};

// 命令保持可选中，复制按钮只写入原始命令，并明确反馈失败。
export const SubtitleTranscriptionProgress = ({
  percent,
}: {
  percent: number;
}) => {
  const normalizedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div
      data-subtitle-tool-transcription-progress
      role="progressbar"
      aria-label="字幕生成总体进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalizedPercent}
      title={`字幕生成总体进度 ${Math.round(normalizedPercent)}%`}
      className="sticky top-0 z-10 h-px shrink-0 overflow-hidden bg-[var(--control-fill)]"
    >
      <div
        className="subtitle-accent-progress h-full transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${normalizedPercent}%` }}
      />
    </div>
  );
};

export const TranscriptionCommands = ({ commands }: { commands: string[] }) => (
  <details
    data-subtitle-tool-transcription-commands
    className="subtitle-diagnostics min-w-0 border-t border-[var(--result-divider)]"
  >
    <summary className="subtitle-diagnostics-summary">
      <span className="inline-flex items-center gap-1.5">
        <Terminal className="size-3.5" aria-hidden="true" />
        执行命令
      </span>
      <ChevronRight className="subtitle-diagnostics-chevron size-3.5 shrink-0" aria-hidden="true" />
    </summary>
    <div className="mt-2 grid gap-1.5">
      {commands.map((command) => (
        <pre
          key={command}
          className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-[6px] border border-[var(--result-divider)] bg-background/70 px-2 py-1.5 text-[length:var(--font-size-caption)] text-foreground"
        >
          <code>{command}</code>
        </pre>
      ))}
    </div>
  </details>
);

// 使用最近一次后端记录，默认收起，避免日志挤占合并界面。
export const MuxDiagnostics = ({ report }: { report: string | null }) => {
  const [copyStatus, setCopyStatus] = useState("");
  return (
    <details className="subtitle-diagnostics min-w-0 border-t border-[var(--result-divider)]">
      <summary className="subtitle-diagnostics-summary">
        <span className="inline-flex items-center gap-1.5">
          <Terminal className="size-3.5" aria-hidden="true" />
          命令与日志
        </span>
        <ChevronRight className="subtitle-diagnostics-chevron size-3.5 shrink-0" aria-hidden="true" />
      </summary>
      <div className="grid min-w-0 gap-3 pb-3 pt-1">
        {report ? <>
          {/* 复制操作固定在右上角，正文预留空间；保留原始日志用于完整复制。 */}
          <div className="relative min-w-0 overflow-hidden rounded-lg bg-background/70">
            <button type="button" aria-label="复制命令与日志" title={copyStatus || "复制命令与日志"} className="absolute right-2 top-2 rounded-md bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                setCopyStatus("已复制");
              } catch {
                setCopyStatus("复制失败，请在下方手动选择复制");
              }
            }}>{copyStatus === "已复制" ? <CircleCheck className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}</button>
            <pre tabIndex={0} aria-label="FFmpeg 命令与日志" className="max-h-64 min-w-0 overflow-y-auto whitespace-pre-wrap p-3 pr-12 font-mono text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]">{report}</pre>
          </div>
          <span role="status" className={copyStatus.startsWith("复制失败") ? "text-xs text-destructive" : "sr-only"}>{copyStatus}</span>
        </> : <p className="rounded-lg bg-background/50 px-3 py-3 text-xs leading-relaxed text-muted-foreground">暂无运行记录，合并后将在此显示命令与日志。</p>}
        <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
          <Captions className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>字幕为可切换轨道，需在播放器中启用。</span>
        </p>
      </div>
    </details>
  );
};

export const SubtitleMuxPageContent = ({
  darkMode,
  activeTool,
  videoPath,
  subtitlePath,
  outputPath,
  generationBatch,
  onRemoveBatchVideo,
  onRevealBatchSubtitle,
  generationVideoPath,
  generationVideoPreview,
  generationDurationMs,
  generationSegments,
  activeGenerationSegmentId,
  generationRangeError,
  canStart,
  canGenerateSubtitle,
  isMerging,
  isGenerating,
  isCancelingGeneration,
  ffmpegStatus,
  ffmpegPath,
  fasterWhisperStatus,
  fasterWhisperPythonPath,
  fasterWhisperModelPath,
  fasterWhisperModelHistory,
  generatedSubtitlePath,
  progressMessage,
  transcriptionProgressMessage,
  transcriptionProgressPercent,
  muxDiagnostics,
  transcriptionCommandLines,
  mergeStatusTone,
  mergeStatusMessage,
  generationStatusTone,
  generationStatusMessage,
  subtitleTranslationPath,
  subtitleTranslationTargetLanguage,
  subtitleTranslationOutputPath,
  subtitleTranslationBatchCharacters,
  subtitleTranslationProxyEnabled,
  onChangeSubtitleTranslationProxyEnabled,
  subtitleTranslationProxyUrl,
  subtitleTranslationConnectionStatus,
  subtitleTranslationConnectionError,
  subtitleTranslationProgressMessage,
  subtitleTranslationProgressPercent,
  isTranslatingSubtitle,
  subtitleTranslationStatusTone,
  subtitleTranslationStatusMessage,
  onChangeActiveTool,
  onDropPaths,
  onChooseVideo,
  onChooseSubtitle,
  onChooseGenerationVideo,
  onChooseSubtitleTranslationFile,
  onChooseFfmpegBinary,
  onChooseFasterWhisperPython,
  onChooseFasterWhisperModel,
  onChangeFfmpegPath,
  onSaveFfmpegPath,
  onChangeFasterWhisperPythonPath,
  onSaveFasterWhisperPythonPath,
  onChangeFasterWhisperModelPath,
  onSaveFasterWhisperModelPath,
  onChangeSubtitleTranslationTargetLanguage,
  onChangeSubtitleTranslationBatchCharacters,
  onChangeSubtitleTranslationProxyUrl,
  onTestSubtitleTranslationConnection,
  onCancelSubtitleTranslation,
  onUseGenerationVideoPath,
  onUseSubtitleTranslationPath,
  onDropGenerationVideoPaths,
  onDropSubtitleTranslationPaths,
  onSelectGenerationSegment,
  onRemoveGenerationSegment,
  onSetGenerationRangeStart,
  onSetGenerationRangeEnd,
  onGenerateSubtitle,
  onCancelGenerateSubtitle,
  onTranslateSubtitle,
  onRevealGeneratedSubtitle,
  onRevealTranslatedSubtitle,
  onRefreshFfmpegStatus,
  onRefreshFasterWhisperStatus,
  onStart,
  onClear,
  onClearGeneration,
  onClearTranslation,
  onRevealOutput,
}: SubtitleMuxPageContentProps) => {
  const [managedWhisperLog, setManagedWhisperLog] = useState("");
  const [whisperReady, setWhisperReady] = useState<boolean | null>(null);
  const hasGenerationBatch = generationBatch.items.length > 0;
  const previewPlayback = useVideoPreviewPlayback(generationVideoPreview);
  const [generationDropNotice, setGenerationDropNotice] = useState<
    string | null
  >(null);

  const ffmpegUnavailable = ffmpegStatus?.available === false;
  const fasterWhisperUnavailable = fasterWhisperStatus?.available === false;
  // 状态栏仅展示版本号，避免构建参数挤占侧栏；完整输出仍保留在悬浮提示中。
  const ffmpegVersion = ffmpegStatus?.version
    ?.match(/^ffmpeg version\s+(\S+)/i)?.[1];
  const ffmpegStatusLabel = ffmpegStatus
    ? ffmpegStatus.available
      ? `ffmpeg 可用${ffmpegStatus.version ? `: ${ffmpegStatus.version.split(/\r?\n/)[0]}` : ""}`
      : "未检测到 ffmpeg"
    : "正在检测 ffmpeg";
  const ffmpegStatusShortLabel = ffmpegStatus
    ? ffmpegStatus.available
      ? `FFmpeg ${ffmpegVersion ?? "可用（版本未知）"}`
      : "未检测到 ffmpeg"
    : "正在检测 ffmpeg";
  const ffmpegStatusTitle = [ffmpegStatusLabel, ffmpegStatus?.error]
    .filter(Boolean)
    .join(" · ");
  const subtitleTranslationTargetLabel =
    subtitleTranslationLanguageOptions.find(
      (option) => option.value === subtitleTranslationTargetLanguage,
    )?.label ?? "中文";
  const normalizedSubtitleTranslationProgressPercent =
    subtitleTranslationProgressPercent === null
      ? null
      : Math.min(100, Math.max(0, subtitleTranslationProgressPercent));
  const hasTranslationFile = Boolean(subtitleTranslationPath);
  const translationIsComplete =
    Boolean(subtitleTranslationOutputPath) &&
    subtitleTranslationStatusTone === "success" &&
    !isTranslatingSubtitle;
  const translationStepStates = getWorkflowStepStates({
    hasInput: hasTranslationFile,
    isComplete: translationIsComplete,
  });
  const subtitleTranslationFileName = getPathTail(subtitleTranslationPath);
  const subtitleTranslationOutputName = getPathTail(
    subtitleTranslationOutputPath,
  );
  const hasGenerationVideo = Boolean(generationVideoPath) || hasGenerationBatch;
  const generationIsComplete = hasGenerationBatch
    ? generationBatch.items.every(item => item.status === "completed")
    : Boolean(generatedSubtitlePath) &&
    generationStatusTone === "success" &&
    !isGenerating;
  const generationStepStates = getWorkflowStepStates({
    hasInput: hasGenerationVideo,
    isComplete: generationIsComplete,
  });
  const canClearMerge = Boolean(
    videoPath ||
      subtitlePath ||
      outputPath ||
      progressMessage ||
      mergeStatusMessage,
  );
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
  const canClearTranslation = Boolean(
    subtitleTranslationPath ||
      subtitleTranslationOutputPath ||
      subtitleTranslationProgressMessage ||
      subtitleTranslationProgressPercent !== null ||
      subtitleTranslationStatusMessage ||
      subtitleTranslationConnectionStatus !== "idle" ||
      subtitleTranslationConnectionError,
  );
  const getPanelState = (toolId: SubtitleToolId) =>
    activeTool === toolId ? "active" : "inactive";
  const renderToolTab = (tool: {
    id: SubtitleToolId;
    label: string;
    icon: LucideIcon;
  }) => {
    const Icon = tool.icon;
    const isActive = activeTool === tool.id;

    return (
      <button
        key={tool.id}
        id={`subtitle-tool-tab-${tool.id}`}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`subtitle-tool-panel-${tool.id}`}
        onClick={() => onChangeActiveTool(tool.id)}
        className={`flex h-9 shrink-0 items-center gap-2 rounded-[7px] px-2.5 text-left text-[length:var(--font-size-control)] leading-[var(--line-height-control)] transition-colors focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[var(--control-accent)] md:w-full ${
          isActive
            ? "bg-[var(--brand-500)] text-[var(--neutral-950)]"
            : "text-muted-foreground hover:bg-[var(--result-row-hover)] hover:text-foreground"
        }`}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{tool.label}</span>
      </button>
    );
  };

  return (
    <ToastProvider duration={2200}>
      <FixedRailLayout
        viewportClassName="px-4 pb-4 pt-3"
        gridProps={{ "data-subtitle-mux-layout": "tools" }}
        gridClassName="md:grid-cols-[176px_minmax(0,1fr)]"
        railProps={{
          "data-subtitle-tool-rail": true,
          "data-subtitle-tool-nav-style": "rail",
        }}
        railClassName="flex min-w-0 gap-1 p-0.5 md:flex-col md:border-r md:border-[var(--result-divider)] md:pr-3"
        contentProps={{
          "data-subtitle-tool-content": true,
          "data-subtitle-tool-content-style": "plain",
        }}
        contentClassName="px-0 py-1 md:pl-1"
        rail={
          <>
            <div
              data-subtitle-duck-brand="true"
              className="mb-4 hidden items-center gap-2.5 px-1 pt-1 md:flex"
            >
              <img
                src={subtitleDuckIconUrl}
                alt=""
                draggable={false}
                className="size-11 select-none rounded-[10px] shadow-[0_10px_22px_-16px_rgba(0,0,0,0.8)]"
              />
              <div className="min-w-0">
                <span className="text-[15px] font-semibold tracking-[0.08em] text-foreground">
                  字幕鸭
                </span>
                {/* 版本由 Vite 从 package.json 注入，与桌面打包版本保持一致。 */}
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground" aria-label="应用版本">
                  v{__APP_VERSION__}
                </p>
              </div>
            </div>
            <nav
              data-subtitle-tool-nav="true"
              role="tablist"
              aria-label="工具功能"
              className="flex min-w-0 gap-1 overflow-x-auto md:flex-col md:overflow-visible"
            >
              {subtitleTools.map(renderToolTab)}
            </nav>
            <div className="mt-2 min-w-0 shrink-0 md:mt-auto">
              <PopoverPrimitive.Root>
                <PopoverPrimitive.Trigger asChild>
                <button
                  type="button"
                  data-subtitle-tool-ffmpeg-status={
                    !ffmpegStatus ? "checking" : ffmpegUnavailable ? "unavailable" : "available"
                  }
                  title={ffmpegStatusTitle || undefined}
                  className={`flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--control-radius-sm)] px-1.5 py-1 text-[length:var(--font-size-caption)] outline-none transition-colors hover:bg-[var(--detail-secondary-action-hover-bg)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)] [&::-webkit-details-marker]:hidden ${
                    ffmpegUnavailable
                      ? "text-[var(--status-error-text)]"
                      : "text-muted-foreground"
                  }`}
                >
                  {!ffmpegStatus ? (
                    <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
                  ) : ffmpegUnavailable ? (
                    <AlertCircle className="size-3.5 shrink-0" />
                  ) : (
                    <CircleCheck className="size-3.5 shrink-0 text-[var(--brand-500)]" />
                  )}
                  <span className="min-w-0 break-all text-left">
                    {ffmpegStatusShortLabel}
                  </span>
                </button>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                  <PopoverPrimitive.Content
                  side="top"
                  align="start"
                  sideOffset={8}
                  collisionPadding={12}
                  className="z-50 grid w-[var(--radix-popover-trigger-width)] min-w-[176px] gap-2 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--app-bg)] p-2 shadow-lg outline-none"
                  >
                  <label className="text-[length:var(--font-size-caption)] text-muted-foreground">
                    FFmpeg 路径
                  </label>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <input
                      value={ffmpegPath}
                      onChange={(event) => onChangeFfmpegPath(event.target.value)}
                      onBlur={(event) => void onSaveFfmpegPath(event.target.value)}
                      spellCheck={false}
                      aria-label="FFmpeg 路径"
                      className="h-7 min-w-0 flex-1 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2 font-mono text-[11px] text-foreground outline-none focus:border-[var(--control-accent)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
                    />
                    <ToolbarIconButton
                      darkMode={darkMode}
                      onClick={() => void onChooseFfmpegBinary()}
                      aria-label="选择 FFmpeg 可执行文件"
                      title="选择 FFmpeg 可执行文件"
                      className="h-7 w-7 shrink-0"
                    >
                      <FolderOpen className="size-3.5" />
                    </ToolbarIconButton>
                  </div>
                  {ffmpegUnavailable ? (
                    <FfmpegInstaller
                      darkMode={darkMode}
                      onRefresh={onRefreshFfmpegStatus}
                    />
                  ) : null}
                  </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
              </PopoverPrimitive.Root>
            </div>
          </>
        }
      >
        {activeTool === "generate" && transcriptionProgressPercent !== null ? (
          <SubtitleTranscriptionProgress percent={transcriptionProgressPercent} />
        ) : null}
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
                {isMerging ? "正在合并字幕" : "开始合并"}
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
              title={mergeStatusTone === "success" ? "合并完成" : "合并输出"}
              state={mergeStatusTone === "success" ? "complete" : videoPath && subtitlePath ? "current" : "upcoming"}
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
                disabled={!canGenerateSubtitle || isGenerating || fasterWhisperUnavailable}
              >
                {isGenerating && transcriptionProgressMessage
                  ? "正在生成字幕"
                  : hasGenerationBatch ? "批量生成字幕" : "生成字幕"}
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
                  const videoPaths = paths.filter(isSubtitleGenerationVideoPath);
                  if (videoPaths.length === 0) {
                    setGenerationDropNotice("仅支持拖入视频文件");
                    return;
                  }
                  onDropGenerationVideoPaths(videoPaths);
                }}
              />
              <div className="mt-3">
                {hasGenerationBatch ? (
                  <SubtitleGenerationBatchList batch={generationBatch} darkMode={darkMode} onRemove={onRemoveBatchVideo} onReveal={onRevealBatchSubtitle} />
                ) : <VideoInfo videoPath={generationVideoPath} />}
              </div>
              </div>
            </WorkflowStep>

            <WorkflowStep
              workflow="generation"
              id="settings"
              number="02"
              title="Faster Whisper"
              titleAccessory={<span className={`ml-auto text-[length:var(--font-size-caption)] ${whisperReady ? "text-[var(--status-success-text)]" : "text-muted-foreground"}`}>
                {whisperReady === null ? "检测中" : whisperReady ? "已就绪" : "待安装"}
              </span>}
              state={generationStepStates.settings}
              isLast={false}
            >
              <div
                data-subtitle-generate-whisper-card="compact"
                data-subtitle-transcription-engine="faster-whisper"
                className="grid min-w-0 content-start gap-2"
              >
                <details className="min-w-0 text-[length:var(--font-size-caption)]">
                  <summary className="cursor-pointer text-muted-foreground">手动配置</summary>
                  {fasterWhisperStatus?.error && <p className="my-2 break-words text-muted-foreground">{fasterWhisperStatus.error}</p>}
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
                                : fasterWhisperModelPath ?? undefined
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
              onEnvironmentChanged={async path => {
                await onChangeFasterWhisperPythonPath(path);
                await onRefreshFasterWhisperStatus();
              }}
            />


            </WorkflowStep>

            {!hasGenerationBatch ? <WorkflowStep
              workflow="generation"
              id="progress"
              number="03"
              title="截取与生成"
              state={generationStepStates.progress}
              isLast
            >
            <div className="grid gap-2.5">
              <p className="text-[length:var(--font-size-caption)] text-muted-foreground">选择片段或识别全片，字幕另存为 SRT。</p>

            <div className="grid gap-2.5">
              {generationVideoPreview && !previewPlayback.isUnavailable ? (
                <video
                  ref={previewPlayback.videoRef}
                  data-subtitle-generate-preview="true"
                  src={previewPlayback.sourceUrl}
                  hidden={isGenerating || Boolean(generatedSubtitlePath)}
                  className="aspect-video mx-auto w-full max-w-[720px] rounded-[8px] bg-black"
                  onTimeUpdate={(event) =>
                    previewPlayback.reportTime(event.currentTarget.currentTime)
                  }
                  onPlay={() => previewPlayback.reportPlaying(true)}
                  onPause={() => previewPlayback.reportPlaying(false)}
                  onEnded={() => previewPlayback.reportPlaying(false)}
                  onError={previewPlayback.reportNativeError}
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
            </WorkflowStep> : generationStatusTone === "error" && generationStatusMessage ? (
              <StatusMessage tone="error">{generationStatusMessage}</StatusMessage>
            ) : null}
            <section aria-labelledby="subtitle-file-merge-title" className="mt-6 min-w-0 border-t border-[var(--form-field-border)] pt-5">
              <h3 id="subtitle-file-merge-title" className="mb-3 flex items-center gap-2 text-sm font-semibold"><Combine className="size-4" />字幕合并</h3>
              <SubtitleFileMergePanel darkMode={darkMode} generatedSubtitlePath={generatedSubtitlePath} />
            </section>
            <div className="mt-4 text-[length:var(--font-size-caption)] text-muted-foreground">
              {managedWhisperLog && <details className="mt-3">
                <summary className="cursor-pointer">安装与下载日志</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px]">{managedWhisperLog}</pre>
              </details>}
            </div>
          </div>
        </section>

        <section
          id="subtitle-tool-panel-translate"
          role="tabpanel"
          aria-labelledby="subtitle-tool-tab-translate"
          data-subtitle-tool-panel="translate"
          data-subtitle-tool-panel-state={getPanelState("translate")}
          hidden={activeTool !== "translate"}
          className="min-w-0"
        >
          <div
            data-subtitle-translation-workflow="true"
            className="relative mx-auto grid w-full max-w-[900px] gap-0 px-1"
          >
            <div className="mb-4 flex justify-end gap-2">
              <ToolbarButton
                darkMode={darkMode}
                onClick={onClearTranslation}
                disabled={!canClearTranslation || isTranslatingSubtitle}
                className="bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                清空
              </ToolbarButton>
              {translationIsComplete ? (
                <ToolbarButton
                  darkMode={darkMode}
                  onClick={() => void onRevealTranslatedSubtitle()}
                  className="subtitle-accent-action shrink-0"
                >
                  打开字幕
                </ToolbarButton>
              ) : isTranslatingSubtitle ? (
                <ToolbarButton
                  darkMode={darkMode}
                  onClick={() => void onCancelSubtitleTranslation()}
                  className="shrink-0"
                >
                  停止翻译
                </ToolbarButton>
              ) : (
                <ToolbarButton
                  darkMode={darkMode}
                  onClick={() => void onTranslateSubtitle()}
                  className="subtitle-accent-action shrink-0"
                  disabled={!subtitleTranslationPath || isTranslatingSubtitle || (subtitleTranslationProxyEnabled && !subtitleTranslationProxyUrl.trim())}
                >
                  {isTranslatingSubtitle ? "正在翻译字幕" : "开始翻译"}
                </ToolbarButton>
              )}
            </div>
            <WorkflowStep
              id="file"
              number="01"
              title="选择字幕"
              state={translationStepStates.file}
              isLast={false}
            >
              <div
                data-subtitle-translation-file-content="true"
                className="grid min-w-0 gap-2"
              >
                {subtitleTranslationPath ? (
                  <div className="min-w-0">
                    <div
                      data-subtitle-translation-file-name="true"
                      title={subtitleTranslationPath}
                      className="truncate text-[length:var(--font-size-control)] font-medium tracking-[-0.015em] text-foreground"
                    >
                      {subtitleTranslationFileName}
                    </div>
                    <div
                      data-subtitle-translation-file-directory="true"
                      title={
                        getPathDirectory(subtitleTranslationPath) ?? undefined
                      }
                      className="truncate text-[length:var(--font-size-caption)] text-muted-foreground"
                    >
                      {getPathDirectory(subtitleTranslationPath)}
                    </div>
                  </div>
                ) : null}
                <FilePathPicker
                  id="subtitle-translate-file"
                  showHeader={false}
                  compact
                  darkMode={darkMode}
                  label="SRT 字幕"
                  icon={<Languages className="size-4 shrink-0" />}
                  selectedPath={subtitleTranslationPath}
                  selectedPathDataAttribute={{
                    "data-subtitle-translate-selected-path": "subtitle",
                  }}
                  placeholder="拖入 SRT 文件，或粘贴路径"
                  dropTitle="拖入 .srt 字幕文件"
                  chooseLabel={
                    subtitleTranslationPath ? "更换字幕" : "选择字幕"
                  }
                  disabled={isTranslatingSubtitle}
                  integratedCard
                  onChoose={onChooseSubtitleTranslationFile}
                  onUsePath={onUseSubtitleTranslationPath}
                  onDropPaths={onDropSubtitleTranslationPaths}
                />
              </div>
            </WorkflowStep>

            <WorkflowStep
              id="settings"
              number="02"
              title="翻译设置"
              state={translationStepStates.settings}
              isLast={false}
            >
              <div className="grid gap-3 sm:grid-cols-[160px_160px]">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="subtitle-translation-language"
                    className="text-[length:var(--font-size-caption)] text-muted-foreground"
                  >
                    目标语言
                  </label>
                  <Select
                    value={subtitleTranslationTargetLanguage}
                    onValueChange={onChangeSubtitleTranslationTargetLanguage}
                    disabled={isTranslatingSubtitle}
                  >
                    <SelectTrigger
                      id="subtitle-translation-language"
                      data-subtitle-translation-language-select
                      className="h-[var(--control-height-md)] w-full min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2.5 text-[length:var(--font-size-control)] text-foreground outline-none transition-colors placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:bg-[var(--form-field-focus-bg)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
                    >
                      <span data-slot="select-value" className="truncate">
                        {subtitleTranslationTargetLabel}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {subtitleTranslationLanguageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="grid gap-1.5">
                  <span className="text-[length:var(--font-size-caption)] text-muted-foreground">
                    每批字符
                  </span>
                  <input
                    data-subtitle-translation-batch-input="true"
                    type="number"
                    min={200}
                    max={4000}
                    step={100}
                    value={subtitleTranslationBatchCharacters}
                    disabled={isTranslatingSubtitle}
                    onChange={(event) =>
                      onChangeSubtitleTranslationBatchCharacters(
                        Number(event.target.value),
                      )
                    }
                    className="h-[var(--control-height-md)] min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2.5 text-[length:var(--font-size-control)] text-foreground outline-none transition-colors placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:bg-[var(--form-field-focus-bg)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
                  />
                </label>
              </div>
            </WorkflowStep>

            <WorkflowStep
              id="progress"
              number="03"
              title="翻译进度"
              state={translationStepStates.progress}
              isLast
            >
              <div className="grid min-w-0 gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="subtitle-accent-icon mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
                    <FolderOpen className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
                      输出
                    </div>
                    <div
                      data-subtitle-translation-output-path="true"
                      title={subtitleTranslationOutputPath ?? undefined}
                      className={`truncate text-[length:var(--font-size-caption)] ${
                        subtitleTranslationOutputPath
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {subtitleTranslationOutputName ?? "等待选择字幕"}
                    </div>
                  </div>
                </div>

                {subtitleTranslationProgressMessage ? (
                  <div
                    data-subtitle-translation-progress="true"
                    role="status"
                    aria-live="polite"
                    className="subtitle-accent-line grid gap-2 pt-1"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3 text-[length:var(--font-size-caption)] text-muted-foreground">
                      <span className="min-w-0 truncate">
                        {subtitleTranslationProgressMessage}
                      </span>
                      {normalizedSubtitleTranslationProgressPercent !== null ? (
                        <span className="shrink-0 tabular-nums">
                          {Math.round(
                            normalizedSubtitleTranslationProgressPercent,
                          )}
                          %
                        </span>
                      ) : null}
                    </div>
                    <div
                      role="progressbar"
                      aria-label="字幕翻译进度"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(
                        normalizedSubtitleTranslationProgressPercent ?? 0,
                      )}
                      className="h-2 overflow-hidden rounded-full bg-white/10 shadow-inner shadow-black/30"
                    >
                      <div
                        className="subtitle-accent-progress h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                        style={{
                          width: `${normalizedSubtitleTranslationProgressPercent ?? 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {subtitleTranslationStatusMessage &&
                subtitleTranslationStatusTone === "neutral" ? (
                  <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
                    {subtitleTranslationStatusMessage}
                  </div>
                ) : subtitleTranslationStatusMessage ? (
                  <div
                    className={`flex items-center gap-2 text-[length:var(--font-size-caption)] ${
                      subtitleTranslationStatusTone === "success"
                        ? "text-[var(--status-success-text)]"
                        : "text-destructive"
                    }`}
                  >
                    {subtitleTranslationStatusTone === "success" ? (
                      <CircleCheck className="size-4 shrink-0" />
                    ) : (
                      <CircleX className="size-4 shrink-0" />
                    )}
                    <span>{subtitleTranslationStatusMessage}</span>
                  </div>
                ) : null}
              </div>
            </WorkflowStep>
          </div>
          {(
            <div className="mx-auto mt-7 w-full max-w-[900px] px-1 text-[length:var(--font-size-caption)]">
              <div className="rounded-2xl bg-white/[0.035] px-4 py-3.5 shadow-[inset_2px_0_0_var(--subtitle-accent-border)]">
                <div className="flex items-center gap-2">
                  <span role="status" className={subtitleTranslationConnectionStatus === "unavailable" ? "text-destructive" : "text-muted-foreground"}>
                    {subtitleTranslationConnectionStatus === "idle" ? "未测试" : subtitleTranslationConnectionStatus === "testing" ? "连接中…" : subtitleTranslationConnectionStatus === "available" ? "连接正常" : "连接失败"}
                  </span>
                  <ToolbarIconButton darkMode={darkMode}
                    onClick={() => void onTestSubtitleTranslationConnection()}
                    disabled={isTranslatingSubtitle || subtitleTranslationConnectionStatus === "testing" || (subtitleTranslationProxyEnabled && !subtitleTranslationProxyUrl.trim())}
                    aria-label="测试连接" title="测试连接" className="ml-auto h-7 w-7 bg-transparent">
                    <RefreshCw className={`size-3.5 ${subtitleTranslationConnectionStatus === "testing" ? "animate-spin" : ""}`} />
                  </ToolbarIconButton>
                </div>
                {subtitleTranslationConnectionStatus === "unavailable" && subtitleTranslationConnectionError ? <p className="mt-2 break-words text-destructive">{subtitleTranslationConnectionError}</p> : null}
                <label className="mt-3 flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" role="switch" checked={subtitleTranslationProxyEnabled} disabled={isTranslatingSubtitle} onChange={(event) => onChangeSubtitleTranslationProxyEnabled(event.target.checked)} className="accent-[var(--control-accent)]" />
                  使用代理
                </label>
                <div className="mt-3 grid items-end gap-x-5 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="flex min-w-0 items-center gap-3 text-muted-foreground">
                    <span className="shrink-0">代理地址</span>
                    <input
                      data-subtitle-translation-proxy-input="true"
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      value={subtitleTranslationProxyUrl}
                      placeholder="http://127.0.0.1:7890"
                      disabled={isTranslatingSubtitle || !subtitleTranslationProxyEnabled}
                      onChange={(event) => onChangeSubtitleTranslationProxyUrl(event.target.value)}
                      className="h-8 min-w-0 max-w-md flex-1 border-b border-white/15 bg-transparent px-1 text-[length:var(--font-size-control)] text-foreground outline-none transition-colors placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:ring-0"
                    />
                  </label>
                  {subtitleTranslationProxyEnabled && !subtitleTranslationProxyUrl.trim() ? <span className="pb-1 text-muted-foreground/80">请填写代理地址</span> : null}
                </div>

              </div>
            </div>
          )}
        </section>

      </FixedRailLayout>
      <Toast
        open={Boolean(generationDropNotice)}
        onOpenChange={(open) => {
          if (!open) setGenerationDropNotice(null);
        }}
      >
        <ToastDescription>{generationDropNotice}</ToastDescription>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
};
