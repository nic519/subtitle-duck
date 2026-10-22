import { FixedRailLayout, ToolbarIconButton } from "@/components/page-ui";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";
import {
  AlertCircle,
  CircleCheck,
  FolderOpen,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { FfmpegInstaller } from "./FfmpegInstaller";
import { SubtitleGenerationPanel } from "./SubtitleGenerationPanel";
import { SubtitleMergePanel } from "./SubtitleMergePanel";
import type {
  SubtitleMuxPageContentProps,
  SubtitleToolId,
} from "./subtitleMuxPageTypes";
import { SubtitleTranslationPanel } from "./SubtitleTranslationPanel";
import {
  subtitleDuckIconUrl,
  subtitleTools,
  SubtitleTranscriptionProgress,
} from "./SubtitleWorkflow";
export type {
  SubtitleMuxPageContentProps,
  SubtitleToolId,
} from "./subtitleMuxPageTypes";
export {
  MuxDiagnostics,
  SubtitleTranscriptionProgress,
  TranscriptionCommands,
} from "./SubtitleWorkflow";

/** 布局层统一承载导航和通知，工具面板保持挂载以保留交互状态。 */
export function SubtitleMuxPageContent(props: SubtitleMuxPageContentProps) {
  const {
    darkMode,
    activeTool,
    ffmpegStatus,
    ffmpegPath,
    transcriptionProgressPercent,
    onChangeActiveTool,
    onChooseFfmpegBinary,
    onChangeFfmpegPath,
    onSaveFfmpegPath,
    onRefreshFfmpegStatus,
  } = props;

  const ffmpegUnavailable = ffmpegStatus?.available === false;

  // 状态栏仅展示版本号，避免构建参数挤占侧栏；完整输出仍保留在悬浮提示中。
  const ffmpegVersion = ffmpegStatus?.version?.match(
    /^ffmpeg version\s+(\S+)/i,
  )?.[1];

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
                <p
                  className="mt-0.5 text-[11px] leading-4 text-muted-foreground"
                  aria-label="应用版本"
                >
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
                      !ffmpegStatus
                        ? "checking"
                        : ffmpegUnavailable
                          ? "unavailable"
                          : "available"
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
                        onChange={(event) =>
                          onChangeFfmpegPath(event.target.value)
                        }
                        onBlur={(event) =>
                          void onSaveFfmpegPath(event.target.value)
                        }
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
          <SubtitleTranscriptionProgress
            percent={transcriptionProgressPercent}
          />
        ) : null}
        <SubtitleMergePanel {...props} />

        <SubtitleGenerationPanel {...props} />

        <SubtitleTranslationPanel {...props} />
      </FixedRailLayout>

      <ToastViewport />
    </ToastProvider>
  );
}
