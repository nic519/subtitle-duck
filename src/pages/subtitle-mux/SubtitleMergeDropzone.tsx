import { useState, type DragEventHandler } from "react";
import { FileVideo, FolderOpen, Languages, Plus } from "lucide-react";
import { ToolbarButton } from "@/components/page-ui";
import { resolveLocalFileImport } from "@/local-file-import/localFileImport";

const getFileName = (path: string | null) =>
  path?.split(/[\\/]/).filter(Boolean).at(-1) ?? null;

const SelectedFile = ({
  kind,
  path,
  onChoose,
  disabled,
  darkMode,
}: {
  kind: "video" | "subtitle";
  path: string | null;
  onChoose: () => void | Promise<void>;
  disabled: boolean;
  darkMode: boolean;
}) => {
  const isVideo = kind === "video";
  const label = isVideo ? "视频" : "字幕";
  const fileName = getFileName(path);
  const Icon = isVideo ? FileVideo : Languages;

  return (
    <div
      data-subtitle-merge-file={kind}
      className="flex min-w-0 items-center gap-3 rounded-[10px] bg-white/[0.025] px-3 py-3 transition-colors hover:bg-white/[0.04]"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--subtitle-accent-soft)] text-[var(--subtitle-accent-muted)]">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
          {label}
        </div>
        {path ? (
          <div
            data-subtitle-mux-selected-path={kind}
            title={path}
            className="truncate text-[length:var(--font-size-control)] text-foreground"
          >
            {fileName}
          </div>
        ) : (
          <div className="text-[length:var(--font-size-control)] text-muted-foreground">
            等待导入
          </div>
        )}
      </div>
      <ToolbarButton
        darkMode={darkMode}
        onClick={() => void onChoose()}
        disabled={disabled}
        className="shrink-0 bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
      >
        {path ? "更换" : `选择${label}`}
      </ToolbarButton>
    </div>
  );
};

export const SubtitleMergeDropzone = ({
  darkMode,
  videoPath,
  subtitlePath,
  disabled,
  onDropPaths,
  onChooseVideo,
  onChooseSubtitle,
}: {
  darkMode: boolean;
  videoPath: string | null;
  subtitlePath: string | null;
  disabled: boolean;
  onDropPaths: (paths: string[]) => void;
  onChooseVideo: () => void | Promise<void>;
  onChooseSubtitle: () => void | Promise<void>;
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const isReady = Boolean(videoPath && subtitlePath);

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
    <div className="grid gap-3" data-subtitle-merge-import="true">
      <div
        data-subtitle-merge-dropzone="true"
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center justify-center text-center transition-colors ${
          isReady
            ? "min-h-0 gap-2 py-1.5 text-[length:var(--font-size-caption)] text-muted-foreground"
            : "min-h-[152px] flex-col rounded-[12px] border border-dashed px-6 py-7"
        } ${
          isDragActive
            ? isReady
              ? "text-[var(--subtitle-accent-muted)]"
              : "border-[var(--subtitle-accent-border)] bg-[var(--subtitle-accent-soft)]"
            : isReady
              ? ""
              : "border-white/15 bg-white/[0.025]"
        }`}
      >
        {isReady ? (
          <>
            <Plus className="size-3.5 text-[var(--subtitle-accent-muted)]" />
            <span>拖入新文件即可替换</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[var(--subtitle-accent-muted)]">
              <FileVideo className="size-5" />
              <Plus className="size-3" />
              <Languages className="size-5" />
            </div>
            <div className="mt-3 text-[length:var(--font-size-control)] font-medium text-foreground">
              把视频和字幕一起拖到这里
            </div>
            <div className="mt-1 text-[length:var(--font-size-caption)] text-muted-foreground">
              1 个视频 + 1 个 SRT、ASS 或 SSA 字幕
            </div>
          </>
        )}
      </div>

      <div className="grid gap-2">
        <SelectedFile
          kind="video"
          path={videoPath}
          onChoose={onChooseVideo}
          disabled={disabled}
          darkMode={darkMode}
        />
        <SelectedFile
          kind="subtitle"
          path={subtitlePath}
          onChoose={onChooseSubtitle}
          disabled={disabled}
          darkMode={darkMode}
        />
      </div>

      {!isReady ? (
        <div className="flex items-center justify-center gap-1.5 text-[length:var(--font-size-caption)] text-muted-foreground">
          <FolderOpen className="size-3.5" />
          也可以分别选择文件
        </div>
      ) : null}
    </div>
  );
};
