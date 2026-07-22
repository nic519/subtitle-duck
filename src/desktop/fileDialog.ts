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

export const chooseLibraryFolder = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> => chooseDirectory(openFileDialog);

export const chooseDatabaseExportFolder = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> => chooseDirectory(openFileDialog);

export const chooseDatabaseImportFile = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> =>
  chooseSinglePath(openFileDialog, {
    allowedFileTypes: "sqlite,db",
    canChooseFiles: true,
    canChooseDirectory: false,
  });

/** 选择旧 PH 软件生成的 SQLite 数据库文件。 */
export const chooseLegacyPhDatabaseFile = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> =>
  chooseDatabaseImportFile({ openFileDialog });

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

export const chooseWhisperModelFile = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> =>
  chooseSinglePath(openFileDialog, {
    allowedFileTypes: "bin",
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

export const chooseWhisperCoreMlPackageFile = async ({
  openFileDialog,
}: {
  openFileDialog: OpenFileDialog;
}): Promise<string | null> =>
  chooseSinglePath(openFileDialog, {
    allowedFileTypes: "zip",
    canChooseFiles: true,
    canChooseDirectory: false,
  });

const normalizeSelectedPath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed.startsWith("file://")) return trimmed;
  return fileURLToPath(trimmed);
};
