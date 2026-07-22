import type { LocalDropData } from "../../utils/dropPaths";
import { resolveDroppedLocalPaths } from "../../utils/dropPaths";

export const resolveLocalFileDrop = async (
  dataTransfer: LocalDropData
): Promise<string[]> =>
  resolveDroppedLocalPaths(dataTransfer, async () => {
    const { desktopApi } = await import("../client");
    const result = await desktopApi.consumeLocalFileDrop();
    return result.paths;
  });
