import {
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Captions,
  CircleCheck,
  CircleX,
  Combine,
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
  transcriptionCommandLines: string[];
  mergeStatusTone: "neutral" | "success" | "error";
  mergeStatusMessage: string | null;
  generationStatusTone: "neutral" | "success" | "error";
  generationStatusMessage: string | null;
  subtitleTranslationPath: string | null;
  subtitleTranslationTargetLanguage: string;
  subtitleTranslationOutputPath: string | null;
  subtitleTranslationBatchCharacters: number;
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
  { id: "merge", label: "字幕合并", icon: Combine },
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
  workflow?: "translation" | "generation";
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
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <h3
            data-subtitle-translation-step-title={workflow === "translation" ? id : undefined}
            data-subtitle-generation-step-title={workflow === "generation" ? id : undefined}
            className="text-[length:var(--font-size-control)] font-semibold tracking-[-0.02em] text-foreground"
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

const InstallCommand = ({ children }: { children: string }) => (
  <code className="block overflow-x-auto rounded-[var(--control-radius-sm)] border border-[var(--result-divider)] bg-[var(--result-surface)] px-2.5 py-2 font-mono text-[11px] leading-5 text-foreground">
    {children}
  </code>
);

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
    className="subtitle-accent-line border-t pt-3"
  >
    <summary className="cursor-pointer list-none text-[length:var(--font-size-caption)] text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
      <span className="inline-flex items-center gap-1.5">
        <Terminal className="size-3.5" aria-hidden="true" />
        执行命令
      </span>
    </summary>
    <div className="mt-2 grid gap-1.5">
      {commands.map((command) => (
        <pre
          key={command}
          className="custom-scrollbar overflow-x-auto whitespace-pre-wrap break-all rounded-[6px] border border-[var(--result-divider)] bg-background/70 px-2 py-1.5 text-[length:var(--font-size-caption)] text-foreground"
        >
          <code>{command}</code>
        </pre>
      ))}
    </div>
  </details>
);

const DependencyGuide = ({
  title,
  description,
  children,
  onRefresh,
  darkMode,
}: {
  title: string;
  description: string;
  children: ReactElement | ReactElement[];
  onRefresh?: () => void | Promise<void>;
  darkMode: boolean;
}) => (
  <details
    open
    data-subtitle-dependency-guide={title}
    className="border-l-2 border-[var(--subtitle-accent-border)] pl-3"
  >
    <summary className="cursor-pointer list-none text-[length:var(--font-size-control)] font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
      <span className="inline-flex items-center gap-2">
        <Terminal className="size-4 text-[var(--subtitle-accent-muted)]" />
        {title}
      </span>
    </summary>
    <div className="grid gap-3 pb-1 pt-2 text-[length:var(--font-size-caption)] text-muted-foreground">
      <p>{description}</p>
      {children}
      {onRefresh ? (
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            darkMode={darkMode}
            onClick={() => void onRefresh()}
            className="h-7 bg-transparent px-2 text-[length:var(--font-size-caption)] text-muted-foreground hover:bg-[var(--result-row-hover)] hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            重新检测
          </ToolbarButton>
          <span>安装完成后点击重新检测；若仍未识别，请完全退出后重开字幕鸭。</span>
        </div>
      ) : null}
    </div>
  </details>
);

const FfmpegInstallGuide = ({
  onRefresh,
  darkMode,
}: {
  onRefresh: () => void | Promise<void>;
  darkMode: boolean;
}) => (
  <DependencyGuide
    title="安装 FFmpeg"
    description="字幕合并和视频预处理需要 FFmpeg。安装后请保持它在系统 PATH 中。"
    onRefresh={onRefresh}
    darkMode={darkMode}
  >
    <div className="grid gap-2">
      <div>macOS（推荐 Homebrew）</div>
      <InstallCommand>brew install ffmpeg</InstallCommand>
      <div>Windows（PowerShell）</div>
      <InstallCommand>winget install Gyan.FFmpeg</InstallCommand>
      <div>安装验证</div>
      <InstallCommand>ffmpeg -version</InstallCommand>
    </div>
  </DependencyGuide>
);

const FasterWhisperInstallGuide = ({
  onRefresh,
  darkMode,
}: {
  onRefresh: () => void | Promise<void>;
  darkMode: boolean;
}) => (
  <DependencyGuide
    title="配置 Faster Whisper"
    description="需要 Python、faster-whisper 包和已下载的 CT2 模型目录。安装后在上方分别选择 Python 与模型目录。"
    onRefresh={onRefresh}
    darkMode={darkMode}
  >
    <div className="grid gap-2">
      <div>安装 Python 包</div>
      <InstallCommand>python3 -m pip install --upgrade faster-whisper huggingface_hub</InstallCommand>
      <div>下载模型（示例）</div>
      <InstallCommand>huggingface-cli download Systran/faster-whisper-large-v3 --local-dir ~/Models/faster-whisper-large-v3</InstallCommand>
    </div>
  </DependencyGuide>
);

export const SubtitleMuxPageContent = ({
  darkMode,
  activeTool,
  videoPath,
  subtitlePath,
  outputPath,
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
  transcriptionCommandLines,
  mergeStatusTone,
  mergeStatusMessage,
  generationStatusTone,
  generationStatusMessage,
  subtitleTranslationPath,
  subtitleTranslationTargetLanguage,
  subtitleTranslationOutputPath,
  subtitleTranslationBatchCharacters,
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
  const previewPlayback = useVideoPreviewPlayback(generationVideoPreview);
  const [generationDropNotice, setGenerationDropNotice] = useState<
    string | null
  >(null);

  const ffmpegUnavailable = ffmpegStatus?.available === false;
  const fasterWhisperUnavailable = fasterWhisperStatus?.available === false;
  const ffmpegStatusLabel = ffmpegStatus
    ? ffmpegStatus.available
      ? `ffmpeg 可用${ffmpegStatus.version ? `: ${ffmpegStatus.version.split(/\r?\n/)[0]}` : ""}`
      : "未检测到 ffmpeg"
    : "正在检测 ffmpeg";
  const ffmpegStatusShortLabel = ffmpegStatus
    ? ffmpegStatus.available
      ? "ffmpeg 可用"
      : "未检测到 ffmpeg"
    : "正在检测 ffmpeg";
  const ffmpegStatusTitle = [ffmpegStatusLabel, ffmpegStatus?.error]
    .filter(Boolean)
    .join(" · ");
  const fasterWhisperStatusState = fasterWhisperStatus
    ? fasterWhisperStatus.available
      ? "available"
      : "unavailable"
    : "checking";
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
  const hasGenerationVideo = Boolean(generationVideoPath);
  const generationIsComplete =
    Boolean(generatedSubtitlePath) &&
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
              <span className="min-w-0 text-[15px] font-semibold tracking-[0.08em] text-foreground">
                字幕鸭
              </span>
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
                    ffmpegUnavailable ? "unavailable" : "available"
                  }
                  title={ffmpegStatusTitle || undefined}
                  className={`flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--control-radius-sm)] px-1.5 py-1 text-[length:var(--font-size-caption)] outline-none transition-colors hover:bg-[var(--detail-secondary-action-hover-bg)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)] [&::-webkit-details-marker]:hidden ${
                    ffmpegUnavailable
                      ? "text-[var(--status-error-text)]"
                      : "text-muted-foreground"
                  }`}
                >
                  {ffmpegUnavailable ? (
                    <AlertCircle className="size-3.5 shrink-0" />
                  ) : (
                    <CircleCheck className="size-3.5 shrink-0 text-[var(--brand-500)]" />
                  )}
                  <span className="min-w-0 truncate">
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
                {isMerging ? "正在合并字幕" : "开始合并"}
              </ToolbarButton>
            </div>
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
              <FfmpegInstallGuide
                darkMode={darkMode}
                onRefresh={onRefreshFfmpegStatus}
              />
            ) : null}

            <div className="flex items-start gap-3 px-3 pt-1">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--subtitle-accent-soft)] text-[var(--subtitle-accent-muted)]">
                <FolderOpen className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
                  输出
                </div>
                <div
                  data-subtitle-mux-output-path="true"
                  className={`break-all text-[length:var(--font-size-caption)] ${
                    outputPath ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {outputPath ?? "等待视频路径"}
                </div>
              </div>
            </div>

            {progressMessage ? (
              <div className="border-l-2 border-[var(--subtitle-accent-border)] pl-3 text-[length:var(--font-size-caption)] text-muted-foreground">
                {progressMessage}
              </div>
            ) : null}

            {mergeStatusTone === "success" && outputPath ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ToolbarButton
                  darkMode={darkMode}
                  onClick={() => void onRevealOutput()}
                  disabled={isMerging}
                >
                  打开文件夹
                </ToolbarButton>
              </div>
            ) : null}

            {mergeStatusMessage && mergeStatusTone === "neutral" ? (
              <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
                {mergeStatusMessage}
              </div>
            ) : mergeStatusMessage ? (
              <StatusMessage tone={mergeStatusTone}>
                {mergeStatusMessage}
              </StatusMessage>
            ) : null}
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
                darkMode={darkMode}
                label="视频"
                icon={<Video className="size-4 shrink-0" />}
                selectedPath={generationVideoPath}
                selectedPathDataAttribute={{
                  "data-subtitle-generate-selected-path": "video",
                }}
                placeholder="粘贴本地视频路径"
                dropTitle="拖入视频文件"
                chooseLabel="选择视频"
                showHeader={false}
                disabled={isGenerating}
                onChoose={onChooseGenerationVideo}
                onUsePath={onUseGenerationVideoPath}
                onDropPaths={(paths) => {
                  const videoPath = paths.find(isSubtitleGenerationVideoPath);
                  if (!videoPath) {
                    setGenerationDropNotice("仅支持拖入视频文件");
                    return;
                  }
                  onDropGenerationVideoPaths([videoPath]);
                }}
              />
              </div>
            </WorkflowStep>

            <WorkflowStep
              workflow="generation"
              id="settings"
              number="02"
              title="Faster Whisper"
              titleAccessory={
                <span
                  data-subtitle-tool-faster-whisper-status={fasterWhisperStatusState}
                  className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${
                    fasterWhisperStatusState === "available"
                      ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                      : fasterWhisperStatusState === "unavailable"
                        ? "bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
                        : "bg-[var(--control-fill)] text-muted-foreground"
                  }`}
                >
                  {fasterWhisperStatusState === "available" ? (
                    <CircleCheck className="size-3" aria-label="可用" />
                  ) : fasterWhisperStatusState === "unavailable" ? (
                    <CircleX className="size-3" aria-label="不可用" />
                  ) : (
                    <LoaderCircle className="size-3" aria-label="检测中" />
                  )}
                  {fasterWhisperStatusState === "available"
                    ? "就绪"
                    : fasterWhisperStatusState === "unavailable"
                      ? "不可用"
                      : "检测中"}
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
                <div className="grid min-w-0 gap-3 border-l-2 border-[var(--subtitle-accent-border)] pl-3">
                      {fasterWhisperStatus?.error ? (
                        <div
                          className="truncate text-[length:var(--font-size-caption)] text-[var(--status-error-text)]"
                          title={fasterWhisperStatus.error}
                        >
                          {fasterWhisperStatus.error}
                        </div>
                      ) : null}
                      <div className="grid min-w-0 gap-1.5 text-[length:var(--font-size-caption)]">
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
                    </div>
              </div>
            {ffmpegUnavailable ? (
              <FfmpegInstallGuide
                darkMode={darkMode}
                onRefresh={onRefreshFfmpegStatus}
              />
            ) : null}

            {fasterWhisperUnavailable ? (
              <FasterWhisperInstallGuide
                onRefresh={onRefreshFasterWhisperStatus}
                darkMode={darkMode}
              />
            ) : null}

            </WorkflowStep>

            <WorkflowStep
              workflow="generation"
              id="progress"
              number="03"
              title="截取与生成"
              state={generationStepStates.progress}
              isLast
            >
            <div className="grid gap-2.5">

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
                    : "当前格式无法直接预览，正在建立实时兼容预览；也可以继续手动输入开始和结束时间。"}
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
                  disabled={!subtitleTranslationPath || isTranslatingSubtitle}
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
                className="grid min-w-0 gap-2 [&_[data-subtitle-translate-selected-path]]:hidden"
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
                  darkMode={darkMode}
                  label="SRT 字幕"
                  icon={<Languages className="size-4 shrink-0" />}
                  selectedPath={subtitleTranslationPath}
                  selectedPathDataAttribute={{
                    "data-subtitle-translate-selected-path": "subtitle",
                  }}
                  placeholder="粘贴本地 .srt 字幕路径"
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
          {subtitleTranslationConnectionStatus === "unavailable" ? (
            <div className="mx-auto mt-7 w-full max-w-[900px] px-1 text-[length:var(--font-size-caption)]">
              <div className="rounded-2xl bg-white/[0.035] px-4 py-3.5 shadow-[inset_2px_0_0_var(--subtitle-accent-border)]">
                <div className="flex items-center gap-2">
                <CircleX className="size-3.5 text-destructive" />
                  <span className="text-destructive">连接需要代理或重试</span>
                  {subtitleTranslationConnectionError ? <span className="sr-only">{subtitleTranslationConnectionError}</span> : null}
                </div>
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
                      disabled={isTranslatingSubtitle}
                      onChange={(event) => onChangeSubtitleTranslationProxyUrl(event.target.value)}
                      className="h-8 min-w-0 max-w-md flex-1 border-b border-white/15 bg-transparent px-1 text-[length:var(--font-size-control)] text-foreground outline-none transition-colors placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:ring-0"
                    />
                  </label>
                  <span className="pb-1 text-muted-foreground/80">留空时使用直接连接</span>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void onTestSubtitleTranslationConnection()}
                    disabled={isTranslatingSubtitle}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
                  >
                    <RefreshCw className="size-3.5" />
                    重新测试
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
