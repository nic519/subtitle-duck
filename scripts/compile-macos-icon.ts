import { mkdirSync } from "node:fs";
import path from "node:path";

// 仅在更新图标时运行，需要完整 Xcode 26+；将两份产物一并提交供 CI 打包。
const output = path.resolve(import.meta.dir, "../assets/macos");
mkdirSync(output, { recursive: true });
const result = Bun.spawnSync([
  "xcrun", "actool", path.resolve(import.meta.dir, "../assets/AppIcon.icon"),
  "--compile", output, "--app-icon", "AppIcon",
  "--output-format", "human-readable-text", "--output-partial-info-plist", "/dev/null",
  "--include-all-app-icons", "--target-device", "mac",
  "--minimum-deployment-target", "14.0", "--platform", "macosx",
], { stdout: "inherit", stderr: "inherit" });
if (result.exitCode !== 0) throw new Error("macOS 图标编译失败，请检查 Xcode 版本。");
