import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../electrobun.config";

const platform = process.platform === "darwin"
  ? "macos"
  : process.platform === "win32"
    ? "win"
    : process.platform === "linux"
      ? "linux"
      : null;

if (!platform) {
  console.error(`Unsupported verification platform: ${process.platform}`);
  process.exit(1);
}

const arch = process.arch === "arm64" ? "arm64" : "x64";
const buildDir = path.resolve("build", `dev-${platform}-${arch}`);
const bundleName = `${config.app.name}-dev`;
const bundlePath = process.platform === "darwin"
  ? path.join(buildDir, `${bundleName}.app`)
  : path.join(buildDir, bundleName);
const launcherPath = process.platform === "darwin"
  ? path.join(bundlePath, "Contents", "MacOS", "launcher")
  : path.join(bundlePath, "bin", process.platform === "win32" ? "launcher.exe" : "launcher");

if (!existsSync(launcherPath)) {
  console.error(`Missing local desktop app launcher: ${launcherPath}`);
  console.error("Run bun run build first.");
  process.exit(1);
}

const tempDir = mkdtempSync(path.join(os.tmpdir(), "subtitle-duck-local-app-"));
const stdoutPath = path.join(tempDir, "stdout.log");
const stderrPath = path.join(tempDir, "stderr.log");

const proc = Bun.spawn([launcherPath], {
  cwd: path.dirname(launcherPath),
  env: { ...Bun.env, SUBTITLE_DUCK_VERIFY_LOCAL_APP: "1" },
  stdout: Bun.file(stdoutPath),
  stderr: Bun.file(stderrPath),
});

try {
  await Bun.sleep(5_000);

  const state = await Promise.race([
    proc.exited.then((code) => ({ type: "exited" as const, code })),
    Bun.sleep(1).then(() => ({ type: "running" as const })),
  ]);

  const stdout = existsSync(stdoutPath) ? readFileSync(stdoutPath, "utf8") : "";
  const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, "utf8") : "";

  if (state.type === "exited") {
    throw new Error(
      `Local desktop app exited early with code ${state.code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }

  if (!stdout.includes("[subtitle-duck] BrowserWindow created")) {
    throw new Error(
      `Local desktop app started but did not reach BrowserWindow creation.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
} finally {
  proc.kill();
  await proc.exited.catch(() => undefined);
  rmSync(tempDir, { recursive: true, force: true });
}

console.log("Local desktop app verified.");
console.log(`App: ${bundlePath}`);
console.log(`Executable: ${launcherPath}`);
