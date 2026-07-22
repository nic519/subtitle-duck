import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../electrobun.config";

const channel = Bun.argv[2] ?? "stable";
const arch = process.arch === "arm64" ? "arm64" : "x64";
const buildDir = path.resolve("build", `${channel}-macos-${arch}`);
const artifactDir = path.resolve("artifacts");
const releaseVersion = (Bun.env.GITHUB_REF_NAME?.replace(/^v/, "") ?? config.app.version).trim();

if (!existsSync(buildDir)) {
  console.error(`Missing Electrobun macOS build folder: ${buildDir}`);
  process.exit(1);
}

const appBundleName = readdirSync(buildDir).find((entry) => entry.endsWith(".app"));

if (!appBundleName) {
  console.error(`No macOS .app bundle found in ${buildDir}`);
  process.exit(1);
}

mkdirSync(artifactDir, { recursive: true });

const appBundlePath = path.join(buildDir, appBundleName);
const dmgArch = arch === "arm64" ? "aarch64" : "x64";
const dmgPath = path.join(artifactDir, `subtitle-duck_${releaseVersion}_${dmgArch}.dmg`);
const zipPath = path.join(artifactDir, `subtitle-duck_${releaseVersion}_${dmgArch}.app.zip`);
const stagingDir = mkdtempSync(path.join(os.tmpdir(), "subtitle-duck-dmg-"));

try {
  rmSync(dmgPath, { force: true });
  rmSync(zipPath, { force: true });

  const stagedAppPath = path.join(stagingDir, appBundleName);
  const stageResult = Bun.spawnSync(["ditto", appBundlePath, stagedAppPath]);
  if (stageResult.exitCode !== 0) throw new Error("Failed to stage the macOS app bundle.");

  const applicationsLink = path.join(stagingDir, "Applications");
  const linkResult = Bun.spawnSync(["ln", "-s", "/Applications", applicationsLink]);
  if (linkResult.exitCode !== 0) throw new Error("Failed to add the Applications shortcut to the DMG.");

  const dmgResult = Bun.spawnSync([
    "hdiutil", "create", "-volname", config.app.name, "-srcfolder", stagingDir,
    "-ov", "-format", "UDZO", dmgPath,
  ]);
  if (dmgResult.exitCode !== 0) throw new Error("Failed to create the macOS DMG.");

  const zipResult = Bun.spawnSync(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", appBundlePath, zipPath]);
  if (zipResult.exitCode !== 0) throw new Error("Failed to create the macOS app zip.");
} finally {
  rmSync(stagingDir, { recursive: true, force: true });
}

console.log(`Created macOS release assets:\n${dmgPath}\n${zipPath}`);
