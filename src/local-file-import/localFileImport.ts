export type LocalFileDropData = {
  files: ArrayLike<File | { path?: string }>;
  getData: (format: string) => string;
};

type LocalFileImportAdapter = {
  consumeNativeDrop: () => Promise<string[]>;
};

const normalizePath = (value: string): string | null => {
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

const normalizeLines = (value: string, skipComments = false): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && (!skipComments || !line.startsWith("#")))
    .map(normalizePath)
    .filter((path): path is string => Boolean(path));

const getDataTransferPaths = (dataTransfer: LocalFileDropData): string[] => {
  const filePaths = Array.from(dataTransfer.files)
    .map((file) =>
      normalizePath((file as File & { path?: string }).path ?? ""),
    )
    .filter((path): path is string => Boolean(path));
  if (filePaths.length > 0) return filePaths;

  const uriPaths = normalizeLines(dataTransfer.getData("text/uri-list"), true);
  if (uriPaths.length > 0) return uriPaths;

  const plainTextPaths = normalizeLines(dataTransfer.getData("text/plain"));
  if (plainTextPaths.length > 0) return plainTextPaths;

  return ["URL", "text", "public.file-url"].flatMap((format) =>
    normalizeLines(dataTransfer.getData(format)),
  );
};

export const createLocalFileImport = (adapter: LocalFileImportAdapter) => ({
  async resolve(dataTransfer: LocalFileDropData): Promise<string[]> {
    const dataTransferPaths = getDataTransferPaths(dataTransfer);
    if (dataTransfer.files.length === 0) return dataTransferPaths;
    try {
      const nativePaths = (await adapter.consumeNativeDrop())
        .map(normalizePath)
        .filter((path): path is string => Boolean(path));
      return nativePaths.length > 0 ? nativePaths : dataTransferPaths;
    } catch {
      return dataTransferPaths;
    }
  },
});

const localFileImport = createLocalFileImport({
  async consumeNativeDrop() {
    const { desktopApi } = await import("../desktop/client");
    return (await desktopApi.consumeLocalFileDrop()).paths;
  },
});

export const resolveLocalFileImport = (dataTransfer: LocalFileDropData) =>
  localFileImport.resolve(dataTransfer);
