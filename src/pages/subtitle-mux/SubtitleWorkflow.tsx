import { Separator } from "@/components/ui/separator";
import {
  Captions,
  ChevronRight,
  CircleCheck,
  Combine,
  Copy,
  Languages,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";
import type { SubtitleToolId } from "./subtitleMuxPageTypes";
// 三个工具共用步骤、路径展示和诊断展示，避免各面板重复实现。

export const subtitleGenerationVideoExtensions = new Set([
  ".mp4",
  ".m4v",
  ".mov",
  ".mkv",
  ".avi",
  ".webm",
  ".wmv",
  ".ts",
]);

export const subtitleDuckIconUrl = new URL(
  "../../../assets/app-icon.png",
  import.meta.url,
).href;

export const isSubtitleGenerationVideoPath = (path: string) => {
  const normalizedPath = path.trim().toLowerCase();
  return Array.from(subtitleGenerationVideoExtensions).some((extension) =>
    normalizedPath.endsWith(extension),
  );
};

export const subtitleTools: Array<{
  id: SubtitleToolId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "merge", label: "视字合并", icon: Combine },
  { id: "generate", label: "字幕生成", icon: Captions },
  { id: "translate", label: "字幕翻译", icon: Languages },
];

export const subtitleTranslationLanguageOptions = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "英语" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" },
];

export const getPathTail = (path: string | null): string | null => {
  if (!path) return null;
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
};

export const getPathDirectory = (path: string | null): string | null => {
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

export const getWorkflowStepStates = ({
  hasInput,
  isComplete,
}: {
  hasInput: boolean;
  isComplete: boolean;
}) =>
  ({
    file: hasInput ? "complete" : "current",
    settings: hasInput ? "complete" : "upcoming",
    progress: isComplete ? "complete" : hasInput ? "current" : "upcoming",
  }) satisfies Record<"file" | "settings" | "progress", TranslationStepState>;

export const WorkflowStep = ({
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
      data-subtitle-translation-step={
        workflow === "translation" ? id : undefined
      }
      data-subtitle-generation-step={workflow === "generation" ? id : undefined}
      data-step-state={state}
      aria-current={state === "current" ? "step" : undefined}
      className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-4"
    >
      <div className="relative flex justify-center">
        <div
          data-subtitle-translation-step-marker-backdrop={
            workflow === "translation" ? id : undefined
          }
          data-subtitle-generation-step-marker-backdrop={
            workflow === "generation" ? id : undefined
          }
          className="relative z-10 flex size-9 items-center justify-center rounded-full bg-[var(--app-bg)]"
        >
          <div
            data-subtitle-translation-step-marker={
              workflow === "translation" ? id : undefined
            }
            data-subtitle-generation-step-marker={
              workflow === "generation" ? id : undefined
            }
            className={`flex size-7 items-center justify-center rounded-full border text-[11px] font-bold tracking-tight transition-all duration-300 motion-reduce:transition-none ${markerClassName}`}
            aria-hidden="true"
          >
            {number}
          </div>
        </div>
        {isLast ? null : (
          <Separator
            data-subtitle-translation-step-thread={
              workflow === "translation" ? id : undefined
            }
            data-subtitle-generation-step-thread={
              workflow === "generation" ? id : undefined
            }
            orientation="vertical"
            className="subtitle-accent-thread absolute bottom-[-28px] top-9 w-px opacity-60"
          />
        )}
      </div>
      <div className={isLast ? "min-w-0" : "min-w-0 pb-6"}>
        <div
          className={`mb-2 flex min-w-0 items-center gap-2 ${workflow === "merge" && id === "output" ? "flex-wrap" : ""}`}
        >
          <h3
            data-subtitle-translation-step-title={
              workflow === "translation" ? id : undefined
            }
            data-subtitle-generation-step-title={
              workflow === "generation" ? id : undefined
            }
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
      <ChevronRight
        className="subtitle-diagnostics-chevron size-3.5 shrink-0"
        aria-hidden="true"
      />
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
        <ChevronRight
          className="subtitle-diagnostics-chevron size-3.5 shrink-0"
          aria-hidden="true"
        />
      </summary>
      <div className="grid min-w-0 gap-3 pb-3 pt-1">
        {report ? (
          <>
            {/* 复制操作固定在右上角，正文预留空间；保留原始日志用于完整复制。 */}
            <div className="relative min-w-0 overflow-hidden rounded-lg bg-background/70">
              <button
                type="button"
                aria-label="复制命令与日志"
                title={copyStatus || "复制命令与日志"}
                className="absolute right-2 top-2 rounded-md bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(report);
                    setCopyStatus("已复制");
                  } catch {
                    setCopyStatus("复制失败，请在下方手动选择复制");
                  }
                }}
              >
                {copyStatus === "已复制" ? (
                  <CircleCheck className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
              </button>
              <pre
                tabIndex={0}
                aria-label="FFmpeg 命令与日志"
                className="max-h-64 min-w-0 overflow-y-auto whitespace-pre-wrap p-3 pr-12 font-mono text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              >
                {report}
              </pre>
            </div>
            <span
              role="status"
              className={
                copyStatus.startsWith("复制失败")
                  ? "text-xs text-destructive"
                  : "sr-only"
              }
            >
              {copyStatus}
            </span>
          </>
        ) : (
          <p className="rounded-lg bg-background/50 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
            暂无运行记录，合并后将在此显示命令与日志。
          </p>
        )}
        <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
          <Captions className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>字幕为可切换轨道，需在播放器中启用。</span>
        </p>
      </div>
    </details>
  );
};
