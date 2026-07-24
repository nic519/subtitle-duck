import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

if (process.platform !== "darwin") {
  console.error("verify-macos-local-app must run on macOS.");
  process.exit(1);
}

const arch = process.arch === "arm64" ? "arm64" : "x64";
const buildDir = path.resolve("build", `dev-macos-${arch}`);
const appPath = path.join(buildDir, "subtitle-duck-dev.app");

if (!existsSync(appPath)) {
  console.error(`Missing local macOS app: ${appPath}`);
  console.error("Run bun run build:mac:local first.");
  process.exit(1);
}

const launcherPath = path.join(appPath, "Contents", "MacOS", "launcher");

if (!existsSync(launcherPath)) {
  console.error(`Missing local macOS app launcher: ${launcherPath}`);
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
      `Local macOS app exited early with code ${state.code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }

  if (!stdout.includes("[subtitle-duck] BrowserWindow created")) {
    throw new Error(
      `Local macOS app started but did not reach BrowserWindow creation.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
} finally {
  proc.kill();
  await proc.exited.catch(() => undefined);
  rmSync(tempDir, { recursive: true, force: true });
}

console.log("Local macOS app verified.");
console.log(`App: ${appPath}`);
console.log(`Executable: ${launcherPath}`);
