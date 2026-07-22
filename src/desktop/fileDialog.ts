import { fileURLToPath } from "node:url";

type OpenFileDialogOptions = {
  startingFolder?: string;
  allowedFileTypes?: string;
  canChooseFiles?: boolean;
  canChooseDirectory?: boolean;
  allowsMultipleSelection?: boolean;
};

type OpenFileDialog = (options: OpenFileDialogOptions) => Promise<string[]>;

const chooseSinglePath = async (
  openFileDialog: OpenFileDialog,
  options: OpenFileDialogOptions,
): Promise<string | null> => {
  const paths = await openFileDialog({
    startingFolder: "~",
    allowsMultipleSelection: false,
    ...options,
  });

  return paths.map(normalizeSelectedPath).find(Boolean) ?? null;
};

const chooseDirectory = (openFileDialog: OpenFileDialog): Promise<string | null> =>
  chooseSinglePath(openFileDialog, {
    canChooseFiles: false,
    canChooseDirectory: true,
  });

export const chooseSubtitleMuxFile = async ({
  openFileDialog,
  allowedFileTypes,
}: {
  openFileDialog: OpenFileDialog;
  allowedFileTypes: string;
}): Promise<string | null> =>
  chooseSinglePath(openFileDialog, {
    allowedFileTypes,
    canChooseFiles: true,
    canChooseDirectory: false,
  });

export const chooseFasterWhisperModelDirectory = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> => chooseDirectory(openFileDialog);

export const chooseFasterWhisperPythonFile = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> =>
  chooseSinglePath(openFileDialog, {
    canChooseFiles: true,
    canChooseDirectory: false,
  });

export const chooseCliExecutableFile = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> =>
  chooseSinglePath(openFileDialog, {
    canChooseFiles: true,
    canChooseDirectory: false,
  });

const normalizeSelectedPath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed.startsWith("file://")) return trimmed;
  return fileURLToPath(trimmed);
};
