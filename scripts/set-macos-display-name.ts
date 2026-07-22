import { cpSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const displayName = "字幕鸭";

if (Bun.env.ELECTROBUN_OS !== "macos") {
  process.exit(0);
}

const findBuiltAppBundle = () => {
  if (Bun.env.ELECTROBUN_WRAPPER_BUNDLE_PATH) {
    return Bun.env.ELECTROBUN_WRAPPER_BUNDLE_PATH;
  }

  const buildDir = Bun.env.ELECTROBUN_BUILD_DIR;
  if (!buildDir || !existsSync(buildDir)) return null;

  const appBundleName = readdirSync(buildDir).find((entry) =>
    entry.endsWith(".app")
  );
  return appBundleName ? path.join(buildDir, appBundleName) : null;
};

const appBundlePath = findBuiltAppBundle();
if (!appBundlePath) {
  console.warn("No macOS .app bundle found for display-name update.");
  process.exit(0);
}

const infoPlistPath = path.join(appBundlePath, "Contents", "Info.plist");
if (!existsSync(infoPlistPath)) {
  console.warn(`Info.plist not found: ${infoPlistPath}`);
  process.exit(0);
}

const setPlistValue = (key: string, value: string) => {
  const setResult = Bun.spawnSync([
    "/usr/libexec/PlistBuddy",
    "-c",
    `Set :${key} ${value}`,
    infoPlistPath,
  ]);

  if (setResult.exitCode === 0) return;

  const addResult = Bun.spawnSync([
    "/usr/libexec/PlistBuddy",
    "-c",
    `Add :${key} string ${value}`,
    infoPlistPath,
  ]);

  if (addResult.exitCode !== 0) {
    throw new Error(`Failed to update ${key} in ${infoPlistPath}`);
  }
};

setPlistValue("CFBundleDisplayName", displayName);
setPlistValue("CFBundleName", displayName);

const nativeFileDropBridgeSource = path.resolve(
  import.meta.dir,
  "../native/macos/build/libSubtitleDuckFileDropBridge.dylib"
);
const nativeFileDropBridgeDestination = path.join(
  appBundlePath,
  "Contents/MacOS/libSubtitleDuckFileDropBridge.dylib"
);
if (!existsSync(nativeFileDropBridgeSource)) {
  throw new Error(
    `Native file drop bridge not found: ${nativeFileDropBridgeSource}`
  );
}
cpSync(nativeFileDropBridgeSource, nativeFileDropBridgeDestination);
