import { describe, expect, mock, test } from "bun:test";
import type { Stats } from "node:fs";
import { getFasterWhisperStatus } from "./fasterWhisperStatus";

describe("getFasterWhisperStatus", () => {
  test("rejects a selected Python directory before attempting to spawn it", async () => {
    const spawn = mock(() => {
      throw new Error("spawn should not run");
    });

    await expect(
      getFasterWhisperStatus(
        {
          pythonPath: "/opt/homebrew/Cellar/python@3.13/3.13.1/Frameworks/Python.framework/Versions/3.13/bin",
          modelPath: "/Users/nicholas/Models/faster-whisper",
        },
        {
          existsSync: () => true,
          resolveExecutable: (path) => path,
          statSync: () => ({ isFile: () => false, mode: 0o755 }) as Stats,
          spawn,
        },
      ),
    ).resolves.toEqual({
      available: false,
      path: "/opt/homebrew/Cellar/python@3.13/3.13.1/Frameworks/Python.framework/Versions/3.13/bin",
      version: null,
      error: "所选 Python 路径不是可执行文件: /opt/homebrew/Cellar/python@3.13/3.13.1/Frameworks/Python.framework/Versions/3.13/bin。请选择 Python 文件，例如 ~/.venv/bin/python。",
    });
    expect(spawn).not.toHaveBeenCalled();
  });
});
