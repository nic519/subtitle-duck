import { mkdirSync } from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") process.exit(0);

const projectRoot = path.resolve(import.meta.dir, "..");
const sourcePath = path.join(
  projectRoot,
  "native/macos/LocalFileDropBridge.mm"
);
const outputDirectory = path.join(projectRoot, "native/macos/build");
const outputPath = path.join(
  outputDirectory,
  "libSubtitleDuckFileDropBridge.dylib"
);

mkdirSync(outputDirectory, { recursive: true });

const result = Bun.spawnSync([
  "xcrun",
  "--sdk",
  "macosx",
  "clang++",
  sourcePath,
  "-o",
  outputPath,
  "-fobjc-arc",
  "-std=c++20",
  "-framework",
  "Cocoa",
  "-shared",
  "-install_name",
  "@executable_path/libSubtitleDuckFileDropBridge.dylib",
]);

if (result.exitCode !== 0) {
  process.stderr.write(result.stderr.toString());
  throw new Error(`Failed to build native file drop bridge (${result.exitCode})`);
}

console.log(`[subtitle-duck] built native file drop bridge: ${outputPath}`);
