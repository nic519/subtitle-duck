import { existsSync } from "node:fs";
import path from "node:path";
import { CString, dlopen, FFIType, JSCallback } from "bun:ffi";

const nativeLibraryName = "libSubtitleDuckFileDropBridge.dylib";

export const parseNativeDroppedFilePaths = (payload: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is string =>
        typeof value === "string" && path.isAbsolute(value)
    );
  } catch {
    return [];
  }
};

export const installNativeFileDropBridge = (
  onDropPaths: (paths: string[]) => void
): { refresh: () => boolean; close: () => void } | null => {
  if (process.platform !== "darwin") return null;
  const libraryPath = path.join(process.cwd(), nativeLibraryName);
  if (!existsSync(libraryPath)) {
    console.error(`[subtitle-duck] native file drop bridge not found: ${nativeLibraryName}`);
    return null;
  }

  const library = dlopen(libraryPath, {
    subtitle_duck_install_file_drop_bridge: {
      args: [FFIType.function],
      returns: FFIType.i32,
    },
    subtitle_duck_refresh_file_drop_bridge: {
      args: [],
      returns: FFIType.i32,
    },
  });

  const callback = new JSCallback(
    (payloadPointer) => {
      const paths = parseNativeDroppedFilePaths(
        new CString(payloadPointer).toString()
      );
      if (paths.length > 0) onDropPaths(paths);
    },
    {
      args: [FFIType.cstring],
      returns: FFIType.void,
      threadsafe: true,
    }
  );

  library.symbols.subtitle_duck_install_file_drop_bridge(callback);
  const refresh = (): boolean =>
    library.symbols.subtitle_duck_refresh_file_drop_bridge() === 1;

  return {
    refresh,
    close: () => {
      callback.close();
      library.close();
    },
  };
};
