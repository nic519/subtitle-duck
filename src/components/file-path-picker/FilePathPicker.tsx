import {
  useEffect,
  useRef,
  useState,
  type DragEventHandler,
  type ReactNode,
} from "react";
import { FolderOpen } from "lucide-react";
import { ToolbarIconButton } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import { resolveLocalFileImport } from "@/local-file-import/localFileImport";

const autoApplyDelayMs = 1200;

export const filePathPickerInputClassName =
  "h-[var(--control-height-md)] min-w-0 rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2.5 text-[length:var(--font-size-control)] text-foreground outline-none transition-colors placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:bg-[var(--form-field-focus-bg)] focus-visible:ring-2 focus-visible:ring-[var(--control-accent)]";

export const FilePathPicker = ({
  id,
  darkMode,
  label,
  icon,
  selectedPath,
  selectedPathDataAttribute,
  placeholder,
  dropTitle,
  chooseLabel,
  disabled,
  fillHeight = false,
  integratedCard = false,
  showHeader = true,
  compact = false,
  applyOnChange = false,
  onChoose,
  onUsePath,
  onDropPaths,
}: {
  id: string;
  darkMode: boolean;
  label: string;
  icon: ReactNode;
  selectedPath: string | null;
  selectedPathDataAttribute: Record<string, string>;
  placeholder: string;
  dropTitle: string;
  chooseLabel: string;
  disabled: boolean;
  fillHeight?: boolean;
  integratedCard?: boolean;
  showHeader?: boolean;
  compact?: boolean;
  applyOnChange?: boolean;
  onChoose: () => void | Promise<void>;
  onUsePath: (path: string) => void;
  onDropPaths: (paths: string[]) => void;
}) => {
  const [draftPath, setDraftPath] = useState(selectedPath ?? "");
  const [isDragActive, setIsDragActive] = useState(false);
  const lastAppliedPathRef = useRef(selectedPath ?? "");
  const autoApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 拖放、文件选择和清空共用已选路径；同步时标记已提交，避免再次自动读取。
  useEffect(() => {
    if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    autoApplyTimerRef.current = null;
    lastAppliedPathRef.current = selectedPath ?? "";
    setDraftPath(selectedPath ?? "");
  }, [selectedPath]);

  useEffect(() => {
    return () => {
      if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const trimmedPath = draftPath.trim();
    if (
      disabled ||
      !trimmedPath ||
      trimmedPath === lastAppliedPathRef.current
    ) {
      return;
    }

    if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    autoApplyTimerRef.current = setTimeout(() => {
      lastAppliedPathRef.current = trimmedPath;
      onUsePath(trimmedPath);
      autoApplyTimerRef.current = null;
    }, autoApplyDelayMs);

    return () => {
      if (autoApplyTimerRef.current) {
        clearTimeout(autoApplyTimerRef.current);
        autoApplyTimerRef.current = null;
      }
    };
  }, [disabled, draftPath, onUsePath]);

  const applyDraftPath = () => {
    const trimmedPath = draftPath.trim();
    if (!trimmedPath) return;
    if (autoApplyTimerRef.current) {
      clearTimeout(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
    }
    lastAppliedPathRef.current = trimmedPath;
    onUsePath(trimmedPath);
  };

  const handleDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  const handleDragLeave: DragEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  };

  const handleDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    if (disabled) return;
    void resolveLocalFileImport(event.dataTransfer).then(onDropPaths);
  };

  return (
    <div
      data-file-path-picker={id}
      data-file-path-picker-fill={fillHeight ? "true" : undefined}
      data-file-path-picker-integrated-card={
        integratedCard ? "true" : undefined
      }
      className={`grid gap-2.5 ${fillHeight ? "h-full" : ""}`}
    >
      {!integratedCard && showHeader ? (
        <div className="flex items-center gap-2 text-[length:var(--font-size-caption)] text-muted-foreground">
          {icon}
          {label}
        </div>
      ) : null}
      {selectedPath && !integratedCard && !compact ? (
        <div
          {...selectedPathDataAttribute}
          className={`break-all text-[length:var(--font-size-caption)] text-foreground ${
            showHeader ? "pl-6" : ""
          }`}
        >
          {selectedPath}
        </div>
      ) : null}
      <div
        data-file-path-picker-drop={id}
        title={isDragActive ? dropTitle : undefined}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`grid min-w-0 gap-2 rounded-[8px] border transition-colors ${
          compact
            ? "p-2"
            : integratedCard
            ? "content-start p-2.5"
            : showHeader
              ? "px-2.5 py-2 sm:grid-cols-[minmax(120px,0.42fr)_minmax(180px,1fr)] sm:items-center"
              : "content-center gap-3 p-4"
        } ${fillHeight ? "h-full" : ""} ${
          isDragActive
            ? "border-[var(--subtitle-accent-border)] bg-[var(--subtitle-accent-soft)]"
            : showHeader
              ? "border-white/10 bg-white/[0.035]"
              : "border-dashed border-white/20 bg-white/[0.02]"
        }`}
      >
        {integratedCard && showHeader ? (
          <div className="flex items-center gap-2 text-[length:var(--font-size-caption)] text-muted-foreground">
            {icon}
            {label}
          </div>
        ) : null}
        {selectedPath && integratedCard && !compact ? (
          <div
            {...selectedPathDataAttribute}
            title={selectedPath}
            className="truncate text-[length:var(--font-size-caption)] text-foreground"
          >
            {selectedPath}
          </div>
        ) : null}
        <div
          className={`grid min-w-0 gap-2 ${
            integratedCard
              ? "grid-cols-[minmax(0,1fr)_auto]"
              : "grid-cols-[minmax(0,1fr)_auto]"
          }`}
        >
          <Input
            {...(compact ? selectedPathDataAttribute : {})}
            aria-label={label + "路径"}
            title={draftPath}
            disabled={disabled}
            value={draftPath}
            onChange={(event) => {
              setDraftPath(event.target.value);
              // 独立字幕合并需要立即同步编辑和清空，避免点击合并时使用上一次的路径。
              if (applyOnChange) onUsePath(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              applyDraftPath();
            }}
            placeholder={placeholder}
            className={filePathPickerInputClassName}
          />
          <ToolbarIconButton
            darkMode={darkMode}
            onClick={() => void onChoose()}
            disabled={disabled}
            aria-label={chooseLabel}
            title={chooseLabel}
            className="subtitle-accent-action"
          >
            <FolderOpen className="size-3.5" />
          </ToolbarIconButton>
        </div>
      </div>
    </div>
  );
};
