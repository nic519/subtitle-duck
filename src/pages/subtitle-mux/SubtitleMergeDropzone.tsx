import { useState, type DragEventHandler } from "react";
import { resolveLocalFileImport } from "@/local-file-import/localFileImport";
import { FileVideo, Languages, Upload } from "lucide-react";
import { FilePathPicker } from "@/components/file-path-picker/FilePathPicker";
import { VideoInfo } from "@/components/video-info/VideoInfo";

// 两个文件区共用已有路径识别逻辑；同时拖入视频和字幕仍会按类型分别填入。
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
  // 整块区域接收拖放，捕获阶段统一消费一次，避免内层文件控件重复处理。
  const handleDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    if (!disabled) setIsDragActive(true);
  };
  const handleDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    if (!disabled) void resolveLocalFileImport(event.dataTransfer).then(onDropPaths);
  };
  return (
  <div className="grid min-w-0 gap-3" data-subtitle-merge-import="true">
    <div
      data-subtitle-merge-dropzone="true"
      onDragEnterCapture={handleDragOver}
      onDragOverCapture={handleDragOver}
      onDragLeaveCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragActive(false);
      }}
      onDropCapture={handleDrop}
      className={`grid min-w-0 gap-3 rounded-[10px] border border-dashed p-3 transition-colors ${isDragActive ? "border-[var(--subtitle-accent-border)] bg-[var(--subtitle-accent-soft)]" : "border-white/20 bg-white/[0.02]"}`}
    >
      <div className="flex items-center justify-center gap-2 text-[length:var(--font-size-caption)] text-muted-foreground">
        <Upload className="size-4" />
        <span>{isDragActive ? "松开以导入" : "同时拖入视频和字幕"}</span>
      </div>
      <div className="grid min-w-0 items-start gap-3 md:grid-cols-2 [&_[data-file-path-picker-drop]]:border-0 [&_[data-file-path-picker-drop]]:bg-transparent [&_[data-file-path-picker-drop]]:p-0">
      <FilePathPicker
        id="subtitle-merge-video"
        darkMode={darkMode}
        label="视频"
        icon={<FileVideo className="size-4 shrink-0" />}
        selectedPath={videoPath}
        selectedPathDataAttribute={{ "data-subtitle-mux-selected-path": "video" }}
        placeholder="拖入视频，或粘贴路径"
        dropTitle="拖入视频"
        chooseLabel="选择视频"
        disabled={disabled}
        compact
        integratedCard
        onChoose={onChooseVideo}
        onUsePath={(path) => onDropPaths([path])}
        onDropPaths={onDropPaths}
      />
      <FilePathPicker
        id="subtitle-merge-subtitle"
        darkMode={darkMode}
        label="字幕 · SRT / ASS / SSA"
        icon={<Languages className="size-4 shrink-0" />}
        selectedPath={subtitlePath}
        selectedPathDataAttribute={{ "data-subtitle-mux-selected-path": "subtitle" }}
        placeholder="拖入字幕，或粘贴路径"
        dropTitle="拖入字幕"
        chooseLabel="选择字幕"
        disabled={disabled}
        compact
        integratedCard
        onChoose={onChooseSubtitle}
        onUsePath={(path) => onDropPaths([path])}
        onDropPaths={onDropPaths}
      />
      </div>
    </div>
    {videoPath ? <VideoInfo videoPath={videoPath} /> : null}
  </div>
  );
};
