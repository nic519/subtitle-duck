import { desktopApi } from "../desktop/client";

export const openFile = async (filePath: string): Promise<void> => {
  try {
    await desktopApi.openFilePath(filePath);
  } catch (err: unknown) {
    throw new Error(
      `打开文件失败: ${err instanceof Error ? err.message : String(err)}`
    );
  }
};

export const revealInFolder = async (filePath: string): Promise<void> => {
  try {
    await desktopApi.revealFilePath(filePath);
  } catch (err: unknown) {
    throw new Error(
      `打开所在文件夹失败: ${err instanceof Error ? err.message : String(err)}`
    );
  }
};
