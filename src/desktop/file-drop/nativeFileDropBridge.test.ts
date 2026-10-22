import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test.skipIf(process.platform !== "darwin")("原生 cstring 回调能接收中文和空格路径而不闪退", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "subtitle-duck-ffi-"));
  try {
    // 在独立进程走真实 C → JS FFI 边界，避免未捕获的回调异常杀死测试运行器。
    const source = path.join(directory, "bridge.c");
    writeFileSync(source, `
      int subtitle_duck_install_file_drop_bridge(void (*callback)(const char *)) {
        callback("[\\\"/tmp/中文 视频.mp4\\\",\\\"/tmp/sub.srt\\\"]");
        return 1;
      }
      int subtitle_duck_refresh_file_drop_bridge(void) { return 1; }
    `);
    const compile = Bun.spawnSync(["cc", "-shared", source, "-o", path.join(directory, "libSubtitleDuckFileDropBridge.dylib")]);
    expect(compile.exitCode).toBe(0);
    const modulePath = path.join(import.meta.dir, "nativeFileDropBridge.ts");
    const script = `
      import { installNativeFileDropBridge } from ${JSON.stringify(modulePath)};
      let received;
      const bridge = installNativeFileDropBridge(paths => { received = paths; });
      setTimeout(() => {
        console.log(JSON.stringify(received));
        bridge.close();
        process.exit(received ? 0 : 2);
      }, 100);
    `;
    const child = Bun.spawn([process.execPath, "-e", script], { cwd: directory, stdout: "pipe", stderr: "pipe" });
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual(["/tmp/中文 视频.mp4", "/tmp/sub.srt"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
