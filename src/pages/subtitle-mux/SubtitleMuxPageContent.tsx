import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  AlertCircle,
  Archive,
  Captions,
  CircleCheck,
  CircleX,
  ExternalLink,
  FolderOpen,
  Languages,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Terminal,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  FixedRailLayout,
  StatusMessage,
  TitleBarActionButton,
  ToolbarButton,
  ToolbarIconButton,
} from "@/components/page-ui";
import { Separator } from "@/components/ui/separator";
import { WindowTitleBarRightContextPortal } from "@/components/app/WindowTitleBar";
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
import type { SubtitleGenerationSegment } from "../../subtitle-mux/subtitleGenerationSegments";
import { SubtitleGenerationSegmentEditor } from "./SubtitleGenerationSegmentEditor";
import { SubtitleMergeDropzone } from "./SubtitleMergeDropzone";

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

type SubtitleTranscriptionEngine = "whisper.cpp" | "faster-whisper";

type FasterWhisperStatus = WhisperStatus;

type WhisperCoreMlStatus = {
  available: boolean;
  expectedPath: string | null;
  installedPath: string | null;
  error: string | null;
};

const subtitleGenerationLanguageOptions = [
  { value: "auto", label: "自动" },
  { value: "ja", label: "日语" },
  { value: "zh", label: "中文" },
  { value: "en", label: "英语" },
];

const subtitleTranscriptionEngineOptions = [
  { value: "whisper.cpp", label: "whisper.cpp" },
  { value: "faster-whisper", label: "Faster Whisper（海南鸡）" },
] as const;

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
  generationVideoPreviewUrl: string | null;
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
  transcriptionEngine: SubtitleTranscriptionEngine;
  whisperStatus: WhisperStatus | null;
  whisperBinaryPath: string;
  fasterWhisperStatus: FasterWhisperStatus | null;
  whisperCoreMlStatus: WhisperCoreMlStatus | null;
  isAppleSilicon: boolean;
  whisperModelPath: string | null;
  fasterWhisperPythonPath: string | null;
  fasterWhisperModelPath: string | null;
  generationLanguage: string;
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
  onChooseWhisperModel: () => void | Promise<void>;
  onChooseFfmpegBinary: () => void | Promise<void>;
  onChooseWhisperBinary: () => void | Promise<void>;
  onChooseFasterWhisperPython: () => void | Promise<void>;
  onChooseFasterWhisperModel: () => void | Promise<void>;
  onChooseWhisperCoreMlPackage: () => void | Promise<void>;
  onChangeTranscriptionEngine: (engine: SubtitleTranscriptionEngine) => void;
  onChangeFfmpegPath: (path: string) => void | Promise<void>;
  onSaveFfmpegPath: (path: string) => void | Promise<void>;
  onChangeWhisperBinaryPath: (path: string) => void | Promise<void>;
  onSaveWhisperBinaryPath: (path: string) => void | Promise<void>;
  onChangeFasterWhisperPythonPath: (path: string) => void | Promise<void>;
  onSaveFasterWhisperPythonPath: (path: string) => void | Promise<void>;
  onChangeFasterWhisperModelPath: (path: string) => void | Promise<void>;
  onSaveFasterWhisperModelPath: (path: string) => void | Promise<void>;
  onChangeGenerationLanguage: (value: string) => void;
  onChangeSubtitleTranslationTargetLanguage: (value: string) => void;
  onChangeSubtitleTranslationBatchCharacters: (value: number) => void;
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
  onRefreshWhisperStatus: () => void | Promise<void>;
  onRefreshFasterWhisperStatus: () => void | Promise<void>;
  onStart: () => void | Promise<void>;
  onClear: () => void;
  onRevealOutput: () => void | Promise<void>;
};

export type SubtitleToolId =
  "merge" | "generate" | "translate";

const subtitleTools: Array<{
  id: SubtitleToolId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "merge", label: "字幕合并", icon: Languages },
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

const TranslationWorkflowStep = ({
  id,
  number,
  title,
  state,
  isLast,
  children,
}: {
  id: "file" | "settings" | "progress";
  number: string;
  title: string;
  state: TranslationStepState;
  isLast: boolean;
  children: ReactElement;
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
      data-subtitle-translation-step={id}
      data-step-state={state}
      aria-current={state === "current" ? "step" : undefined}
      className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-4"
    >
      <div className="relative flex justify-center">
        <div
          data-subtitle-translation-step-marker-backdrop={id}
          className="relative z-10 flex size-9 items-center justify-center rounded-full bg-[var(--app-bg)]"
        >
          <div
            data-subtitle-translation-step-marker={id}
            className={`flex size-7 items-center justify-center rounded-full border text-[11px] font-bold tracking-tight transition-all duration-300 motion-reduce:transition-none ${markerClassName}`}
            aria-hidden="true"
          >
            {number}
          </div>
        </div>
        {isLast ? null : (
          <Separator
            data-subtitle-translation-step-thread={id}
            orientation="vertical"
            className="subtitle-accent-thread absolute bottom-[-28px] top-9 w-px opacity-60"
          />
        )}
      </div>
      <div className={isLast ? "min-w-0" : "min-w-0 pb-6"}>
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <h3
            data-subtitle-translation-step-title={id}
            className="text-[length:var(--font-size-control)] font-semibold tracking-[-0.02em] text-foreground"
          >
            {title}
          </h3>
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

const WhisperInstallGuide = ({
  engine,
  onRefresh,
  darkMode,
}: {
  engine: SubtitleTranscriptionEngine;
  onRefresh: () => void | Promise<void>;
  darkMode: boolean;
}) =>
  engine === "faster-whisper" ? (
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
  ) : (
    <DependencyGuide
      title="配置 whisper.cpp"
      description="需要 whisper-cli 命令行工具和 GGML 格式模型。请将 whisper-cli 加入系统 PATH，然后在上方选择模型文件。"
      onRefresh={onRefresh}
      darkMode={darkMode}
    >
      <div className="grid gap-2">
        <div>macOS（Homebrew）</div>
        <InstallCommand>brew install whisper-cpp</InstallCommand>
        <div>安装验证</div>
        <InstallCommand>whisper-cli --help</InstallCommand>
        <a
          href="https://github.com/ggml-org/whisper.cpp"
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1 text-[var(--subtitle-accent-muted)] hover:text-foreground"
        >
          查看 whisper.cpp 与模型下载说明
          <ExternalLink className="size-3" />
        </a>
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
  generationVideoPreviewUrl,
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
  transcriptionEngine,
  whisperStatus,
  whisperBinaryPath,
  fasterWhisperStatus,
  whisperCoreMlStatus,
  isAppleSilicon,
  whisperModelPath,
  fasterWhisperPythonPath,
  fasterWhisperModelPath,
  generationLanguage,
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
  onChooseWhisperModel,
  onChooseFfmpegBinary,
  onChooseWhisperBinary,
  onChooseFasterWhisperPython,
  onChooseFasterWhisperModel,
  onChooseWhisperCoreMlPackage,
  onChangeTranscriptionEngine,
  onChangeFfmpegPath,
  onSaveFfmpegPath,
  onChangeWhisperBinaryPath,
  onSaveWhisperBinaryPath,
  onChangeFasterWhisperPythonPath,
  onSaveFasterWhisperPythonPath,
  onChangeFasterWhisperModelPath,
  onSaveFasterWhisperModelPath,
  onChangeGenerationLanguage,
  onChangeSubtitleTranslationTargetLanguage,
  onChangeSubtitleTranslationBatchCharacters,
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
  onRefreshWhisperStatus,
  onRefreshFasterWhisperStatus,
  onStart,
  onClear,
  onRevealOutput,
}: SubtitleMuxPageContentProps) => {
  const [generationPlayheadMs, setGenerationPlayheadMs] = useState(0);
  const [isGenerationPreviewPlaying, setIsGenerationPreviewPlaying] =
    useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPreviewUnavailable, setIsPreviewUnavailable] = useState(false);
  const [isToolNavVisible, setIsToolNavVisible] = useState(true);
  const [generationDropNotice, setGenerationDropNotice] = useState<
    string | null
  >(null);

  useEffect(() => {
    setIsPreviewUnavailable(false);
  }, [generationVideoPreviewUrl]);

  const ffmpegUnavailable = ffmpegStatus?.available === false;
  const whisperUnavailable = whisperStatus?.available === false;
  const fasterWhisperUnavailable = fasterWhisperStatus?.available === false;
  const whisperStatusState = whisperStatus
    ? whisperStatus.available
      ? "available"
      : "unavailable"
    : "checking";
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
  const whisperCoreMlLabel = whisperCoreMlStatus
    ? whisperCoreMlStatus.available
      ? "Core ML 加速已就绪"
      : "Core ML 加速未安装"
    : "正在检测 Core ML 加速";
  const whisperModelLabel = getPathTail(whisperModelPath);
  const fasterWhisperStatusState = fasterWhisperStatus
    ? fasterWhisperStatus.available
      ? "available"
      : "unavailable"
    : "checking";
  const whisperCoreMlPath =
    whisperCoreMlStatus?.installedPath ?? whisperCoreMlStatus?.expectedPath;
  const whisperCoreMlTitle = [
    whisperCoreMlLabel,
    whisperCoreMlPath,
    whisperCoreMlStatus?.error,
  ]
    .filter(Boolean)
    .join(" · ");
  const whisperCoreMlShortLabel = whisperCoreMlStatus
    ? whisperCoreMlStatus.available
      ? "Core ML 已就绪"
      : "Core ML 未安装"
    : "Core ML 检测中";
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
  const translationFileStepState: TranslationStepState = hasTranslationFile
    ? "complete"
    : "current";
  const translationSettingsStepState: TranslationStepState = hasTranslationFile
    ? "complete"
    : "upcoming";
  const translationProgressStepState: TranslationStepState =
    translationIsComplete
      ? "complete"
      : hasTranslationFile
        ? "current"
        : "upcoming";
  const subtitleTranslationFileName = getPathTail(subtitleTranslationPath);
  const subtitleTranslationOutputName = getPathTail(
    subtitleTranslationOutputPath,
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
            ? "bg-[var(--control-fill-active)] text-foreground"
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
        gridClassName={`${
          isToolNavVisible
            ? "md:grid-cols-[176px_minmax(0,1fr)]"
            : "md:grid-cols-[44px_minmax(0,1fr)]"
        }`}
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
            {isToolNavVisible ? (
              <>
                <div className="flex justify-end px-0.5">
                  <ToolbarIconButton
                    type="button"
                    darkMode={darkMode}
                    aria-label="隐藏工具栏"
                    title="隐藏工具栏"
                    onClick={() => setIsToolNavVisible(false)}
                    className="h-7 w-7"
                  >
                    <PanelLeftClose className="size-3.5" />
                  </ToolbarIconButton>
                </div>
                <nav
                  data-subtitle-tool-nav="true"
                  role="tablist"
                  aria-label="工具功能"
                  className="flex min-w-0 gap-1 overflow-x-auto md:flex-col md:overflow-visible"
                >
                  {subtitleTools.map(renderToolTab)}
                </nav>
                <div
                  data-subtitle-tool-ffmpeg-status={
                    ffmpegUnavailable ? "unavailable" : "available"
                  }
                  title={ffmpegStatusTitle || undefined}
                  className={`mt-2 flex min-w-0 shrink-0 items-center gap-1.5 text-[length:var(--font-size-caption)] md:mt-auto ${
                    ffmpegUnavailable
                      ? "text-[var(--status-error-text)]"
                      : "text-muted-foreground"
                  }`}
                >
                  {ffmpegUnavailable ? (
                    <AlertCircle className="size-3.5 shrink-0" />
                  ) : (
                    <CircleCheck className="size-3.5 shrink-0 text-[var(--status-success-text)]" />
                  )}
                  <span className="min-w-0 truncate">
                    {ffmpegStatusShortLabel}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-center px-1">
                <ToolbarIconButton
                  type="button"
                  darkMode={darkMode}
                  aria-label="显示工具栏"
                  title="显示工具栏"
                  onClick={() => setIsToolNavVisible(true)}
                  className="h-8 w-8"
                >
                  <PanelLeftOpen className="size-3.5" />
                </ToolbarIconButton>
              </div>
            )}
          </>
        }
      >
        <section
          id="subtitle-tool-panel-merge"
          role="tabpanel"
          aria-labelledby="subtitle-tool-tab-merge"
          data-subtitle-tool-panel="merge"
          data-subtitle-tool-panel-state={getPanelState("merge")}
          hidden={activeTool !== "merge"}
          className="mx-auto w-full max-w-[900px] min-w-0"
        >
          {activeTool === "merge" ? (
            <WindowTitleBarRightContextPortal>
              <div
                data-subtitle-merge-title-bar-actions
                className="flex shrink-0 items-center gap-2"
              >
                <TitleBarActionButton
                  darkMode={darkMode}
                  onClick={() => void onStart()}
                  className="subtitle-accent-action shrink-0"
                  disabled={!canStart || isMerging || ffmpegUnavailable}
                >
                  {isMerging ? "正在合并字幕" : "开始合并"}
                </TitleBarActionButton>
              </div>
            </WindowTitleBarRightContextPortal>
          ) : null}
          <div className="grid gap-4">
            <SubtitleMergeDropzone
              darkMode={darkMode}
              videoPath={videoPath}
              subtitlePath={subtitlePath}
              disabled={isMerging}
              onDropPaths={onDropPaths}
              onChooseVideo={onChooseVideo}
              onChooseSubtitle={onChooseSubtitle}
            />

            <label className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2 px-3 text-[length:var(--font-size-caption)]">
              <span className="text-muted-foreground">FFmpeg</span>
              <input
                value={ffmpegPath}
                onChange={(event) => onChangeFfmpegPath(event.target.value)}
                onBlur={(event) => void onSaveFfmpegPath(event.target.value)}
                disabled={isMerging}
                spellCheck={false}
                aria-label="FFmpeg 路径"
                className="h-7 min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2 font-mono text-[11px] text-foreground outline-none focus:border-[var(--control-accent)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
              />
              <ToolbarIconButton
                darkMode={darkMode}
                onClick={() => void onChooseFfmpegBinary()}
                disabled={isMerging}
                aria-label="选择 FFmpeg 可执行文件"
                title="选择 FFmpeg 可执行文件"
                className="h-7 w-7"
              >
                <FolderOpen className="size-3.5" />
              </ToolbarIconButton>
            </label>

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

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ToolbarButton
                darkMode={darkMode}
                onClick={onClear}
                disabled={isMerging}
                className="bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                清空
              </ToolbarButton>
              {mergeStatusTone === "success" && outputPath ? (
                <ToolbarButton
                  darkMode={darkMode}
                  onClick={() => void onRevealOutput()}
                  disabled={isMerging}
                >
                  打开文件夹
                </ToolbarButton>
              ) : null}
            </div>

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
          {activeTool === "generate" ? (
            <WindowTitleBarRightContextPortal>
              <div
                data-subtitle-generate-title-bar-actions
                className="flex shrink-0 items-center gap-2"
              >
                {isGenerating ? (
                  <TitleBarActionButton
                    darkMode={darkMode}
                    onClick={() => void onCancelGenerateSubtitle()}
                    disabled={isCancelingGeneration}
                  >
                    {isCancelingGeneration ? "正在停止" : "停止任务"}
                  </TitleBarActionButton>
                ) : null}
                <TitleBarActionButton
                  darkMode={darkMode}
                  onClick={() => void onGenerateSubtitle()}
                  className="subtitle-accent-action shrink-0"
                  disabled={
                    !canGenerateSubtitle ||
                    isGenerating ||
                    (transcriptionEngine === "faster-whisper"
                      ? fasterWhisperUnavailable
                      : whisperUnavailable)
                  }
                >
                  {isGenerating && transcriptionProgressMessage
                    ? "正在生成字幕"
                    : "生成字幕"}
                </TitleBarActionButton>
              </div>
            </WindowTitleBarRightContextPortal>
          ) : null}
          <div className="mx-auto grid w-full max-w-[900px] gap-4">
            <div
              data-subtitle-generate-setup-row
              className="grid gap-4 md:grid-cols-2 md:items-stretch"
            >
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

              <div
                data-subtitle-generate-whisper-card="compact"
                data-subtitle-transcription-engine={transcriptionEngine}
                className="grid min-w-0 content-start gap-2 pt-1"
              >
                <label className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-2 text-[length:var(--font-size-caption)] text-muted-foreground">
                  <span className="whitespace-nowrap">引擎</span>
                  <Select
                    value={transcriptionEngine}
                    onValueChange={(value) =>
                      onChangeTranscriptionEngine(
                        value as SubtitleTranscriptionEngine,
                      )
                    }
                    disabled={isGenerating}
                  >
                    <SelectTrigger className="h-[var(--control-height-md)] w-full min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2.5 text-[length:var(--font-size-control)] text-foreground outline-none transition-colors focus:border-[var(--control-accent)] focus:bg-[var(--form-field-focus-bg)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]">
                      <span data-slot="select-value" className="truncate">
                        {
                          subtitleTranscriptionEngineOptions.find(
                            (option) => option.value === transcriptionEngine,
                          )?.label
                        }
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {subtitleTranscriptionEngineOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {transcriptionEngine === "faster-whisper" ? (
                  <>
                    <div className="grid min-w-0 gap-3 border-l-2 border-[var(--subtitle-accent-border)] pl-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Captions className="size-4 shrink-0 text-[var(--subtitle-accent-muted)]" />
                        <span className="truncate text-[length:var(--font-size-control)] font-medium text-foreground">
                          Faster Whisper
                        </span>
                        <span
                          data-subtitle-tool-faster-whisper-status={
                            fasterWhisperStatusState
                          }
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
                            <LoaderCircle
                              className="size-3"
                              aria-label="检测中"
                            />
                          )}
                          {fasterWhisperStatusState === "available"
                            ? "就绪"
                            : fasterWhisperStatusState === "unavailable"
                              ? "不可用"
                              : "检测中"}
                        </span>
                      </div>
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
                            title={fasterWhisperModelPath ?? undefined}
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
                              spellCheck={false}
                              aria-label="Faster Whisper CT2 模型目录"
                              className="h-7 w-full min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2 font-mono text-[11px] text-foreground outline-none placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
                            />
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
                      <div className="flex items-center gap-2 text-[length:var(--font-size-caption)] text-muted-foreground">
                        <span className="h-px w-5 bg-[var(--subtitle-accent-border)]" />
                        日语识别 · 输出中文字幕
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[length:var(--font-size-caption)] text-muted-foreground">
                      <div className="flex min-w-0 items-center gap-2">
                        <Captions className="size-4 shrink-0" />
                        <span className="truncate">whisper.cpp</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          data-subtitle-tool-whisper-status={whisperStatusState}
                          className={`shrink-0 ${
                            whisperStatusState === "available"
                              ? "text-[var(--status-success-text)]"
                              : whisperStatusState === "unavailable"
                                ? "text-[var(--status-error-text)]"
                                : "text-muted-foreground"
                          }`}
                        >
                          {whisperStatusState === "available" ? (
                            <CircleCheck className="size-4" aria-label="可用" />
                          ) : whisperStatusState === "unavailable" ? (
                            <CircleX className="size-4" aria-label="不可用" />
                          ) : (
                            <LoaderCircle
                              className="size-4"
                              aria-label="检测中"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    {whisperStatus?.error ? (
                      <div
                        className="truncate text-[length:var(--font-size-caption)] text-[var(--status-error-text)]"
                        title={whisperStatus.error}
                      >
                        {whisperStatus.error}
                      </div>
                    ) : null}
                    <div className="grid min-w-0 gap-1 text-[length:var(--font-size-caption)]">
                      <div className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)_auto] items-center gap-2">
                        <span className="whitespace-nowrap text-muted-foreground">
                          命令行
                        </span>
                        <input
                          value={whisperBinaryPath}
                          onChange={(event) =>
                            onChangeWhisperBinaryPath(event.target.value)
                          }
                          onBlur={(event) =>
                            void onSaveWhisperBinaryPath(event.target.value)
                          }
                          disabled={isGenerating}
                          spellCheck={false}
                          aria-label="whisper-cli 路径"
                          className="h-7 min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2 font-mono text-[11px] text-foreground outline-none focus:border-[var(--control-accent)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
                        />
                        <ToolbarIconButton
                          darkMode={darkMode}
                          onClick={() => void onChooseWhisperBinary()}
                          disabled={isGenerating}
                          aria-label="选择 whisper-cli 可执行文件"
                          title="选择 whisper-cli 可执行文件"
                          className="h-7 w-7"
                        >
                          <FolderOpen className="size-3.5" />
                        </ToolbarIconButton>
                      </div>
                      <div className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)_auto] items-center gap-2">
                        <span className="whitespace-nowrap text-muted-foreground">
                          模型
                        </span>
                        <span
                          data-subtitle-tool-whisper-model-path
                          title={whisperModelPath ?? undefined}
                          className={`truncate ${
                            whisperModelPath
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {whisperModelLabel ?? "未选择"}
                        </span>
                        <ToolbarIconButton
                          data-subtitle-tool-whisper-model-action
                          darkMode={darkMode}
                          onClick={() => void onChooseWhisperModel()}
                          disabled={isGenerating}
                          aria-label="选择模型"
                          title="选择模型"
                          className="h-7 w-7"
                        >
                          <FolderOpen className="size-3.5" />
                        </ToolbarIconButton>
                      </div>
                      {isAppleSilicon ? (
                        <div
                          data-subtitle-tool-whisper-coreml-status
                          title={whisperCoreMlTitle || undefined}
                          className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)_auto] items-center gap-2"
                        >
                          <span
                            data-subtitle-tool-whisper-coreml-label
                            className="whitespace-nowrap text-muted-foreground"
                          >
                            Apple Silicon 加速
                          </span>
                          <span
                            className={`flex min-w-0 items-center gap-1.5 truncate ${
                              whisperCoreMlStatus?.available
                                ? "text-[var(--status-success-text)]"
                                : "text-muted-foreground"
                            }`}
                          >
                            {whisperCoreMlStatus?.available ? (
                              <CircleCheck className="size-3.5 shrink-0" />
                            ) : whisperCoreMlStatus ? (
                              <CircleX className="size-3.5 shrink-0" />
                            ) : (
                              <LoaderCircle className="size-3.5 shrink-0" />
                            )}
                            <span className="truncate">
                              {whisperCoreMlShortLabel}
                            </span>
                          </span>
                          <ToolbarIconButton
                            data-subtitle-tool-whisper-coreml-action
                            darkMode={darkMode}
                            onClick={() => void onChooseWhisperCoreMlPackage()}
                            disabled={isGenerating || !whisperModelPath}
                            aria-label="安装 Core ML 加速包"
                            title="安装 Core ML 加速包"
                            className="h-7 w-7"
                          >
                            <Archive className="size-3.5" />
                          </ToolbarIconButton>
                        </div>
                      ) : null}
                    </div>
                    <label className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-2 text-[length:var(--font-size-caption)] text-muted-foreground">
                      <span className="whitespace-nowrap">语言</span>
                      <Select
                        value={generationLanguage}
                        onValueChange={onChangeGenerationLanguage}
                        disabled={isGenerating}
                      >
                        <SelectTrigger
                          data-subtitle-generation-language-select
                          className="h-[var(--control-height-md)] w-full max-w-[160px] min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2.5 text-[length:var(--font-size-control)] text-foreground outline-none transition-colors placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:bg-[var(--form-field-focus-bg)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]"
                        >
                          <span data-slot="select-value" className="truncate">
                            {subtitleGenerationLanguageOptions.find(
                              (option) => option.value === generationLanguage,
                            )?.label ?? "自动"}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {subtitleGenerationLanguageOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </>
                )}
              </div>
            </div>

            {ffmpegUnavailable ? (
              <FfmpegInstallGuide
                darkMode={darkMode}
                onRefresh={onRefreshFfmpegStatus}
              />
            ) : null}

            {(transcriptionEngine === "faster-whisper"
              ? fasterWhisperUnavailable
              : whisperUnavailable) ? (
              <WhisperInstallGuide
                engine={transcriptionEngine}
                onRefresh={
                  transcriptionEngine === "faster-whisper"
                    ? onRefreshFasterWhisperStatus
                    : onRefreshWhisperStatus
                }
                darkMode={darkMode}
              />
            ) : null}

            <div className="grid gap-2.5">
              {generationVideoPreviewUrl && !isPreviewUnavailable ? (
                <video
                  ref={videoRef}
                  data-subtitle-generate-preview="true"
                  src={generationVideoPreviewUrl}
                  className="aspect-video mx-auto w-full max-w-[720px] rounded-[8px] bg-black"
                  onTimeUpdate={(event) =>
                    setGenerationPlayheadMs(
                      Math.round(event.currentTarget.currentTime * 1000),
                    )
                  }
                  onPlay={() => setIsGenerationPreviewPlaying(true)}
                  onPause={() => setIsGenerationPreviewPlaying(false)}
                  onEnded={() => setIsGenerationPreviewPlaying(false)}
                  onError={() => setIsPreviewUnavailable(true)}
                />
              ) : generationVideoPath ? (
                <div className="rounded-[8px] bg-[var(--result-surface)] px-3 py-4 text-[length:var(--font-size-caption)] text-muted-foreground">
                  当前格式无法直接预览。兼容预览生成完成后会自动切换；也可以继续手动输入开始和结束时间。
                </div>
              ) : null}

              <SubtitleGenerationSegmentEditor
                durationMs={generationDurationMs ?? 0}
                playheadMs={generationPlayheadMs}
                isPlaying={isGenerationPreviewPlaying}
                segments={generationSegments}
                activeSegmentId={activeGenerationSegmentId}
                disabled={isGenerating || !generationVideoPath}
                error={generationRangeError}
                onSelectSegment={onSelectGenerationSegment}
                onRemoveSegment={onRemoveGenerationSegment}
                onSeek={(timeMs) => {
                  if (!videoRef.current) return;
                  videoRef.current.currentTime = timeMs / 1000;
                  setGenerationPlayheadMs(timeMs);
                }}
                onTogglePlayback={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  if (video.paused) {
                    void video.play().catch(() => undefined);
                  } else {
                    video.pause();
                  }
                }}
                onSetStartFromPlayhead={() =>
                  onSetGenerationRangeStart(
                    videoRef.current
                      ? Math.round(videoRef.current.currentTime * 1000)
                      : null,
                  )
                }
                onSetEndFromPlayhead={() =>
                  onSetGenerationRangeEnd(
                    videoRef.current
                      ? Math.round(videoRef.current.currentTime * 1000)
                      : null,
                  )
                }
              />
          </div>

            {transcriptionProgressMessage ? (
              <div className="border-l-2 border-[var(--subtitle-accent-border)] pl-3 text-[length:var(--font-size-caption)] text-muted-foreground">
                {transcriptionProgressMessage}
              </div>
            ) : null}

            {transcriptionProgressPercent !== null ? (
              <div
                data-subtitle-tool-transcription-progress
                role="progressbar"
                aria-label="字幕生成进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={transcriptionProgressPercent}
                className="grid gap-1.5"
              >
                <div className="flex items-center justify-between text-[length:var(--font-size-caption)] text-muted-foreground">
                  <span>识别进度</span>
                  <span>{transcriptionProgressPercent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--control-fill)]">
                  <div
                    className="h-full rounded-full bg-[var(--subtitle-accent-muted)] transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${transcriptionProgressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}

            {transcriptionCommandLines.length > 0 ? (
              <div
                data-subtitle-tool-transcription-commands
                className="subtitle-accent-line grid gap-1.5 border-t pt-3"
              >
                <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
                  执行命令
                </div>
                <div className="grid gap-1.5">
                  {transcriptionCommandLines.map((command) => (
                    <pre
                      key={command}
                      className="custom-scrollbar overflow-x-auto whitespace-pre-wrap break-all rounded-[6px] border border-[var(--result-divider)] bg-background/70 px-2 py-1.5 text-[length:var(--font-size-caption)] text-foreground"
                    >
                      <code>{command}</code>
                    </pre>
                  ))}
                </div>
              </div>
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
          {activeTool === "translate" ? (
            <WindowTitleBarRightContextPortal>
              <div
                data-subtitle-translation-title-bar-actions
                className="flex shrink-0 items-center gap-2"
              >
                {translationIsComplete ? (
                  <TitleBarActionButton
                    darkMode={darkMode}
                    onClick={() => void onRevealTranslatedSubtitle()}
                    className="subtitle-accent-action shrink-0"
                  >
                    打开字幕
                  </TitleBarActionButton>
                ) : (
                  <TitleBarActionButton
                    darkMode={darkMode}
                    onClick={() => void onTranslateSubtitle()}
                    className="subtitle-accent-action shrink-0"
                    disabled={!subtitleTranslationPath || isTranslatingSubtitle}
                  >
                    {isTranslatingSubtitle ? "正在翻译字幕" : "开始翻译"}
                  </TitleBarActionButton>
                )}
              </div>
            </WindowTitleBarRightContextPortal>
          ) : null}
          <div
            data-subtitle-translation-workflow="true"
            className="relative mx-auto grid w-full max-w-[900px] gap-0 px-1"
          >
            <TranslationWorkflowStep
              id="file"
              number="01"
              title="选择字幕"
              state={translationFileStepState}
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
            </TranslationWorkflowStep>

            <TranslationWorkflowStep
              id="settings"
              number="02"
              title="翻译设置"
              state={translationSettingsStepState}
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
            </TranslationWorkflowStep>

            <div className="ml-11 border-l-2 border-[var(--subtitle-accent-border)] pl-3 text-[length:var(--font-size-caption)] text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Languages className="size-4 text-[var(--subtitle-accent-muted)]" />
                在线翻译服务
              </div>
              <p className="mt-1.5 leading-5">
                字幕翻译使用 Google 翻译在线服务，无需安装 FFmpeg、Python 或其他本地插件。请保持网络可用；翻译内容会发送至第三方服务。
              </p>
              <p className="mt-1 leading-5">
                若翻译失败，请检查网络或代理后重试。
              </p>
            </div>

            <TranslationWorkflowStep
              id="progress"
              number="03"
              title="翻译进度"
              state={translationProgressStepState}
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
                    className="subtitle-accent-line grid gap-2 border-t pt-3"
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
                  <StatusMessage tone={subtitleTranslationStatusTone}>
                    {subtitleTranslationStatusMessage}
                  </StatusMessage>
                ) : null}
              </div>
            </TranslationWorkflowStep>
          </div>
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
