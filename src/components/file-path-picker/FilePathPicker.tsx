import {
  useEffect,
  useRef,
  useState,
  type DragEventHandler,
  type ReactNode,
} from "react";
import { FolderOpen } from "lucide-react";
import { ToolbarButton } from "@/components/page-ui";
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
  onChoose: () => void | Promise<void>;
  onUsePath: (path: string) => void;
  onDropPaths: (paths: string[]) => void;
}) => {
  const [draftPath, setDraftPath] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const lastAppliedPathRef = useRef("");
  const autoApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      {selectedPath && !integratedCard ? (
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
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`grid min-w-0 gap-2 rounded-[8px] border transition-colors ${
          integratedCard
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
        {integratedCard ? (
          <div className="flex items-center gap-2 text-[length:var(--font-size-caption)] text-muted-foreground">
            {icon}
            {label}
          </div>
        ) : null}
        <div className="min-w-0">
          <div
            className={`${showHeader ? "truncate" : ""} text-[length:var(--font-size-caption)] font-medium text-foreground`}
          >
            {selectedPath ? dropTitle : `未选择 · ${dropTitle}`}
          </div>
          <div
            className={`${showHeader ? "truncate" : ""} text-[length:var(--font-size-caption)] text-muted-foreground`}
          >
            粘贴后自动确认；可拖入本地文件。
          </div>
        </div>
        {selectedPath && integratedCard ? (
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
            value={draftPath}
            onChange={(event) => setDraftPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              applyDraftPath();
            }}
            placeholder={placeholder}
            className={filePathPickerInputClassName}
          />
          <ToolbarButton
            darkMode={darkMode}
            onClick={() => void onChoose()}
            disabled={disabled}
            className="subtitle-accent-action"
          >
            <FolderOpen className="size-3.5" />
            {chooseLabel}
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
};
