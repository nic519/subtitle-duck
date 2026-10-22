import { FilePathPicker } from "@/components/file-path-picker/FilePathPicker";
import { ToolbarButton, ToolbarIconButton } from "@/components/page-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  CircleCheck,
  CircleX,
  FolderOpen,
  Languages,
  RefreshCw,
} from "lucide-react";
import type {
  SubtitleMuxPageContentProps,
  SubtitleToolId,
} from "./subtitleMuxPageTypes";
import {
  getPathDirectory,
  getPathTail,
  getWorkflowStepStates,
  subtitleTranslationLanguageOptions,
  WorkflowStep,
} from "./SubtitleWorkflow";

type Props = Pick<
  SubtitleMuxPageContentProps,
  | "darkMode"
  | "activeTool"
  | "subtitleTranslationPath"
  | "subtitleTranslationTargetLanguage"
  | "subtitleTranslationOutputPath"
  | "subtitleTranslationBatchCharacters"
  | "subtitleTranslationProxyEnabled"
  | "onChangeSubtitleTranslationProxyEnabled"
  | "subtitleTranslationProxyUrl"
  | "subtitleTranslationConnectionStatus"
  | "subtitleTranslationConnectionError"
  | "subtitleTranslationProgressMessage"
  | "subtitleTranslationProgressPercent"
  | "isTranslatingSubtitle"
  | "subtitleTranslationStatusTone"
  | "subtitleTranslationStatusMessage"
  | "onChooseSubtitleTranslationFile"
  | "onChangeSubtitleTranslationTargetLanguage"
  | "onChangeSubtitleTranslationBatchCharacters"
  | "onChangeSubtitleTranslationProxyUrl"
  | "onTestSubtitleTranslationConnection"
  | "onCancelSubtitleTranslation"
  | "onUseSubtitleTranslationPath"
  | "onDropSubtitleTranslationPaths"
  | "onTranslateSubtitle"
  | "onRevealTranslatedSubtitle"
  | "onClearTranslation"
>;

/** 翻译文件、设置与结果，只依赖所属工作流的数据和动作。 */
export function SubtitleTranslationPanel({
  darkMode,
  activeTool,
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
  onChooseSubtitleTranslationFile,
  onChangeSubtitleTranslationTargetLanguage,
  onChangeSubtitleTranslationBatchCharacters,
  onChangeSubtitleTranslationProxyUrl,
  onTestSubtitleTranslationConnection,
  onCancelSubtitleTranslation,
  onUseSubtitleTranslationPath,
  onDropSubtitleTranslationPaths,
  onTranslateSubtitle,
  onRevealTranslatedSubtitle,
  onClearTranslation,
}: Props) {
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
  return (
    <>
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
                disabled={
                  !subtitleTranslationPath ||
                  isTranslatingSubtitle ||
                  (subtitleTranslationProxyEnabled &&
                    !subtitleTranslationProxyUrl.trim())
                }
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
                chooseLabel={subtitleTranslationPath ? "更换字幕" : "选择字幕"}
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
        {
          <div className="mx-auto mt-7 w-full max-w-[900px] px-1 text-[length:var(--font-size-caption)]">
            <div className="rounded-2xl bg-white/[0.035] px-4 py-3.5 shadow-[inset_2px_0_0_var(--subtitle-accent-border)]">
              <div className="flex items-center gap-2">
                <span
                  role="status"
                  className={
                    subtitleTranslationConnectionStatus === "unavailable"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {subtitleTranslationConnectionStatus === "idle"
                    ? "未测试"
                    : subtitleTranslationConnectionStatus === "testing"
                      ? "连接中…"
                      : subtitleTranslationConnectionStatus === "available"
                        ? "连接正常"
                        : "连接失败"}
                </span>
                <ToolbarIconButton
                  darkMode={darkMode}
                  onClick={() => void onTestSubtitleTranslationConnection()}
                  disabled={
                    isTranslatingSubtitle ||
                    subtitleTranslationConnectionStatus === "testing" ||
                    (subtitleTranslationProxyEnabled &&
                      !subtitleTranslationProxyUrl.trim())
                  }
                  aria-label="测试连接"
                  title="测试连接"
                  className="ml-auto h-7 w-7 bg-transparent"
                >
                  <RefreshCw
                    className={`size-3.5 ${subtitleTranslationConnectionStatus === "testing" ? "animate-spin" : ""}`}
                  />
                </ToolbarIconButton>
              </div>
              {subtitleTranslationConnectionStatus === "unavailable" &&
              subtitleTranslationConnectionError ? (
                <p className="mt-2 break-words text-destructive">
                  {subtitleTranslationConnectionError}
                </p>
              ) : null}
              <label className="mt-3 flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  role="switch"
                  checked={subtitleTranslationProxyEnabled}
                  disabled={isTranslatingSubtitle}
                  onChange={(event) =>
                    onChangeSubtitleTranslationProxyEnabled(
                      event.target.checked,
                    )
                  }
                  className="accent-[var(--control-accent)]"
                />
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
                    disabled={
                      isTranslatingSubtitle || !subtitleTranslationProxyEnabled
                    }
                    onChange={(event) =>
                      onChangeSubtitleTranslationProxyUrl(event.target.value)
                    }
                    className="h-8 min-w-0 max-w-md flex-1 border-b border-white/15 bg-transparent px-1 text-[length:var(--font-size-control)] text-foreground outline-none transition-colors placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:ring-0"
                  />
                </label>
                {subtitleTranslationProxyEnabled &&
                !subtitleTranslationProxyUrl.trim() ? (
                  <span className="pb-1 text-muted-foreground/80">
                    请填写代理地址
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        }
      </section>
    </>
  );
}
