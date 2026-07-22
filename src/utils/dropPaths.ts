export const normalizeDroppedPath = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith("file://")) return trimmed;

  try {
    const { pathname } = new URL(trimmed);
    return decodeURIComponent(pathname).replace(/^\/([A-Za-z]:\/)/, "$1");
  } catch {
    return trimmed;
  }
};

export type LocalDropData = {
  files: ArrayLike<File>;
  getData: (format: string) => string;
};

export const getDroppedLocalPaths = (
  dataTransfer: LocalDropData,
): string[] =>
  extractLocalDropPaths({
    filePaths: Array.from(dataTransfer.files).map(
      (file) => (file as File & { path?: string }).path ?? "",
    ),
    uriList: dataTransfer.getData("text/uri-list"),
    plainText: dataTransfer.getData("text/plain"),
    fallbackText: [
      dataTransfer.getData("URL"),
      dataTransfer.getData("text"),
      dataTransfer.getData("public.file-url"),
    ],
  });

export const resolveDroppedLocalPaths = async (
  dataTransfer: LocalDropData,
  consumeNativeDrop: () => Promise<string[]>,
): Promise<string[]> => {
  const paths = getDroppedLocalPaths(dataTransfer);
  if (dataTransfer.files.length === 0) return paths;
  const nativePaths = await consumeNativeDrop();
  return nativePaths.length > 0 ? nativePaths : paths;
};

export const extractLocalDropPaths = ({
  filePaths,
  uriList,
  plainText,
  fallbackText = [],
}: {
  filePaths: string[];
  uriList: string;
  plainText: string;
  fallbackText?: string[];
}): string[] => {
  const normalizedFilePaths = filePaths
    .map((path) => normalizeDroppedPath(path))
    .filter((path): path is string => Boolean(path));
  if (normalizedFilePaths.length > 0) return normalizedFilePaths;

  const normalizedUriList = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => normalizeDroppedPath(line))
    .filter((path): path is string => Boolean(path));
  if (normalizedUriList.length > 0) return normalizedUriList;

  const normalizedPlainText = plainText
    .split(/\r?\n/)
    .map((line) => normalizeDroppedPath(line))
    .filter((path): path is string => Boolean(path));
  if (normalizedPlainText.length > 0) return normalizedPlainText;

  return fallbackText
    .flatMap((value) => value.split(/\r?\n/))
    .map((line) => normalizeDroppedPath(line))
    .filter((path): path is string => Boolean(path));
};
