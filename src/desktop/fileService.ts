import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { Utils } from "electrobun/bun";

export const normalizeWindowsPath = (filePath: string) =>
  filePath.replace(/\//g, "\\");

export const describeMissingPath = (
  filePath: string,
  platform = process.platform
) => {
  if (platform === "darwin" && filePath.startsWith("/Volumes/")) {
    const segments = filePath.split("/").filter(Boolean);
    const volumeName = segments[1];
    if (volumeName) {
      return `文件所在卷未挂载: /Volumes/${volumeName}（原路径: ${filePath}）`;
    }
  }

  return `文件或文件夹不存在: ${filePath}`;
};

const trimWindowsTrailingSeparators = (filePath: string) => {
  const normalizedPath = normalizeWindowsPath(filePath);

  if (/^[A-Za-z]:\\?$/.test(normalizedPath)) {
    return `${normalizedPath.slice(0, 2)}\\`;
  }

  const uncShareRoot = normalizedPath.match(/^(\\\\[^\\]+\\[^\\]+)\\?$/);
  if (uncShareRoot) {
    return `${uncShareRoot[1]}\\`;
  }

  return normalizedPath.replace(/\\+$/, "");
};

const isWindowsUncPath = (filePath: string) =>
  normalizeWindowsPath(filePath).startsWith("\\\\");

const getWindowsParentDirectory = (filePath: string) =>
  path.win32.dirname(normalizeWindowsPath(filePath));

const buildWindowsRevealScript = () =>
  Buffer.from(
    [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type @'",
      "using System;",
      "using System.IO;",
      "using System.Runtime.InteropServices;",
      "public static class ElectrobunRevealPath {",
      "  [DllImport(\"shell32.dll\", CharSet = CharSet.Unicode)]",
      "  private static extern int SHParseDisplayName(string name, IntPtr pbc, out IntPtr ppidl, uint sfgaoIn, out uint psfgaoOut);",
      "  [DllImport(\"shell32.dll\")]",
      "  private static extern int SHOpenFolderAndSelectItems(IntPtr pidlFolder, uint cidl, IntPtr apidl, uint dwFlags);",
      "  [DllImport(\"shell32.dll\")]",
      "  private static extern IntPtr ILClone(IntPtr pidl);",
      "  [DllImport(\"shell32.dll\")]",
      "  private static extern bool ILRemoveLastID(IntPtr pidl);",
      "  [DllImport(\"shell32.dll\")]",
      "  private static extern IntPtr ILFindLastID(IntPtr pidl);",
      "  [DllImport(\"ole32.dll\")]",
      "  private static extern int CoInitializeEx(IntPtr pvReserved, uint dwCoInit);",
      "  [DllImport(\"ole32.dll\")]",
      "  private static extern void CoTaskMemFree(IntPtr pv);",
      "  [DllImport(\"ole32.dll\")]",
      "  private static extern void CoUninitialize();",
      "  public static void Reveal(string path) {",
      "    int initHr = CoInitializeEx(IntPtr.Zero, 0x2);",
      "    if (initHr < 0) Marshal.ThrowExceptionForHR(initHr);",
      "    IntPtr fullPidl;",
      "    IntPtr parentPidl = IntPtr.Zero;",
      "    uint attrs;",
      "    try {",
      "      int hr = SHParseDisplayName(path, IntPtr.Zero, out fullPidl, 0, out attrs);",
      "      if (hr != 0 || fullPidl == IntPtr.Zero) Marshal.ThrowExceptionForHR(hr);",
      "      try {",
      "        parentPidl = ILClone(fullPidl);",
      "        if (parentPidl == IntPtr.Zero) throw new IOException(\"ILClone failed\");",
      "        if (!ILRemoveLastID(parentPidl)) throw new IOException(\"ILRemoveLastID failed\");",
      "        IntPtr childPidl = ILFindLastID(fullPidl);",
      "        if (childPidl == IntPtr.Zero) throw new IOException(\"ILFindLastID failed\");",
      "        IntPtr childArray = Marshal.AllocHGlobal(IntPtr.Size);",
      "        try {",
      "          Marshal.WriteIntPtr(childArray, childPidl);",
      "          hr = SHOpenFolderAndSelectItems(parentPidl, 1, childArray, 0);",
      "        } finally {",
      "          Marshal.FreeHGlobal(childArray);",
      "        }",
      "        if (hr != 0) Marshal.ThrowExceptionForHR(hr);",
      "      } finally {",
      "        if (parentPidl != IntPtr.Zero) CoTaskMemFree(parentPidl);",
      "        CoTaskMemFree(fullPidl);",
      "      }",
      "    } finally {",
      "      if (initHr >= 0) CoUninitialize();",
      "    }",
      "  }",
      "}",
      "'@",
      "$path = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:ELECTROBUN_REVEAL_PATH_B64))",
      "[ElectrobunRevealPath]::Reveal($path)",
    ].join("\n"),
    "utf16le"
  ).toString("base64");

export const getRevealCommand = (
  filePath: string,
  isDirectory: boolean,
  platform = process.platform
): string[] => {
  if (platform === "darwin") {
    return isDirectory ? ["open", filePath] : ["open", "-R", filePath];
  }

  if (platform === "win32") {
    if (isDirectory) {
      return ["explorer.exe", trimWindowsTrailingSeparators(filePath)];
    }

    if (isWindowsUncPath(filePath)) {
      return ["explorer.exe", getWindowsParentDirectory(filePath)];
    }

    return [
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      buildWindowsRevealScript(),
    ];
  }

  return ["xdg-open", isDirectory ? filePath : path.dirname(filePath)];
};

export const openFilePath = async (filePath: string): Promise<void> => {
  if (!existsSync(filePath)) {
    throw new Error(describeMissingPath(filePath));
  }

  const opened = Utils.openPath(filePath);
  if (!opened) {
    throw new Error(`无法打开文件: ${filePath}`);
  }
};

export const revealFilePath = async (filePath: string): Promise<void> => {
  if (!existsSync(filePath)) {
    throw new Error(describeMissingPath(filePath));
  }

  const isDirectory = statSync(filePath).isDirectory();
  const command = getRevealCommand(filePath, isDirectory);
  const env =
    process.platform === "win32" && !isDirectory && !isWindowsUncPath(filePath)
      ? {
          ...process.env,
          ELECTROBUN_REVEAL_PATH_B64: Buffer.from(
            normalizeWindowsPath(filePath),
            "utf8"
          ).toString("base64"),
        }
      : process.env;

  const result = Bun.spawnSync(command, { env });

  if (result.exitCode !== 0) {
    const stderr = result.stderr ? new TextDecoder().decode(result.stderr).trim() : "";
    throw new Error(stderr || `命令执行失败: ${command.join(" ")}`);
  }
};
