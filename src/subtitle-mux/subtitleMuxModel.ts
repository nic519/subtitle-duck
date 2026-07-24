const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".m4v",
  ".ts",
]);

const SUBTITLE_EXTENSIONS = new Set([".srt", ".ass", ".ssa"]);
const COMMON_UNSUPPORTED_SUBTITLE_EXTENSIONS = new Set([
  ".vtt",
  ".sub",
  ".idx",
  ".sup",
]);

export type SubtitleMuxDraft = {
  videoPath: string | null;
  subtitlePath: string | null;
  outputPath: string | null;
  error: string | null;
};

const normalizePath = (value: string): string => value.trim();

const getPathParts = (filePath: string) => {
  const normalized = normalizePath(filePath);
  const lastSeparatorIndex = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\")
  );
  const fileName = normalized.slice(lastSeparatorIndex + 1);
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase() : "";
  const directory =
    lastSeparatorIndex >= 0 ? normalized.slice(0, lastSeparatorIndex) : "";
  const separator =
    lastSeparatorIndex >= 0
      ? normalized.slice(lastSeparatorIndex, lastSeparatorIndex + 1)
      : "";
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  return { directory, separator, baseName, extension };
};

const hasSupportedExtension = (
  filePath: string,
  extensions: Set<string>
): boolean => extensions.has(getPathParts(filePath).extension);

export const buildSubtitleMuxOutputPath = (videoPath: string): string => {
  const { directory, separator, baseName } = getPathParts(videoPath);
  return `${directory}${separator}${baseName}.muxed.mkv`;
};

const getSubtitleMuxPathGroups = (rawPaths: string[]) => {
  const paths = rawPaths.map(normalizePath).filter(Boolean);
  const videoPaths = paths.filter((filePath) =>
    hasSupportedExtension(filePath, VIDEO_EXTENSIONS)
  );
  const subtitlePaths = paths.filter((filePath) =>
    hasSupportedExtension(filePath, SUBTITLE_EXTENSIONS)
  );
  const unsupportedSubtitlePath = paths.find((filePath) =>
    COMMON_UNSUPPORTED_SUBTITLE_EXTENSIONS.has(getPathParts(filePath).extension)
  );
  const unsupportedPath = paths.find((filePath) => {
    const extension = getPathParts(filePath).extension;
    return (
      extension &&
      !VIDEO_EXTENSIONS.has(extension) &&
      !SUBTITLE_EXTENSIONS.has(extension)
    );
  });

  return {
    paths,
    videoPaths,
    subtitlePaths,
    unsupportedSubtitlePath,
    unsupportedPath,
  };
};

export const classifySubtitleMuxDropPaths = (
  rawPaths: string[]
): SubtitleMuxDraft => {
  const {
    paths,
    videoPaths,
    subtitlePaths,
    unsupportedSubtitlePath,
    unsupportedPath,
  } = getSubtitleMuxPathGroups(rawPaths);
  const videoPath = videoPaths[0] ?? null;
  const subtitlePath = subtitlePaths[0] ?? null;
  const outputPath = videoPath ? buildSubtitleMuxOutputPath(videoPath) : null;

  if (unsupportedSubtitlePath) {
    return {
      videoPath,
      subtitlePath,
      outputPath,
      error: "只支持 srt、ass、ssa 字幕文件",
    };
  }

  if (unsupportedPath) {
    return {
      videoPath,
      subtitlePath,
      outputPath,
      error: "只支持视频文件和 srt、ass、ssa 字幕文件",
    };
  }

  if (videoPaths.length !== 1 || subtitlePaths.length !== 1 || paths.length !== 2) {
    return {
      videoPath,
      subtitlePath,
      outputPath,
      error: "请拖入 1 个视频文件和 1 个字幕文件",
    };
  }

  return {
    videoPath,
    subtitlePath,
    outputPath,
    error: null,
  };
};

export const mergeSubtitleMuxDraftWithDropPaths = (
  current: SubtitleMuxDraft,
  rawPaths: string[]
): SubtitleMuxDraft => {
  const {
    paths,
    videoPaths,
    subtitlePaths,
    unsupportedSubtitlePath,
    unsupportedPath,
  } = getSubtitleMuxPathGroups(rawPaths);

  const videoPath = videoPaths[0] ?? current.videoPath;
  const subtitlePath = subtitlePaths[0] ?? current.subtitlePath;
  const outputPath = videoPath ? buildSubtitleMuxOutputPath(videoPath) : null;

  if (paths.length === 0) {
    return {
      videoPath,
      subtitlePath,
      outputPath,
      error: "拖放没有读取到文件，请重新拖入或使用选择视频/选择字幕",
    };
  }

  if (unsupportedSubtitlePath) {
    return {
      videoPath,
      subtitlePath,
      outputPath,
      error: "只支持 srt、ass、ssa 字幕文件",
    };
  }

  if (unsupportedPath) {
    return {
      videoPath,
      subtitlePath,
      outputPath,
      error: "只支持视频文件和 srt、ass、ssa 字幕文件",
    };
  }

  if (videoPaths.length > 1 || subtitlePaths.length > 1 || paths.length > 2) {
    return {
      videoPath,
      subtitlePath,
      outputPath,
      error: "请拖入 1 个视频文件和 1 个字幕文件",
    };
  }

  return classifySubtitleMuxDropPaths(
    [videoPath, subtitlePath].filter((path): path is string => Boolean(path))
  );
};
