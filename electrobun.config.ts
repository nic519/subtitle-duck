import type { ElectrobunConfig } from "electrobun";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default {
  // Bun.Archive, used by Electrobun's stable updater bundle, cannot archive
  // non-ASCII paths. The macOS post-build hook still sets the visible name to “字幕鸭”.
  app: { name: "subtitle-duck", identifier: "com.subtitleduck.app", version: packageJson.version },
  runtime: { exitOnLastWindowClosed: true },
  build: {
    // 升级框架时保留 Bun，避免同时改变原生 FFI 和子进程的运行环境。
    mainProcess: "bun",
    bun: { entrypoint: "src/desktop/index.ts" },
    watchIgnore: ["dist/**"],
    copy: { dist: "views/main" },
    mac: {
      // 框架先生成兼容图标；构建钩子再安装预编译的原生图标及 ICNS 回退。
      icons: "assets/app-icon.iconset",
      bundleCEF: false,
      codesign: false,
      notarize: false,
      // The release workflow creates the distributable DMG after the build.
      createDmg: false,
    },
    linux: { icon: "assets/app-icon.png", bundleCEF: false },
    win: { icon: "assets/app-icon.ico", bundleCEF: false },
  },
  scripts: {
    postBuild: "./scripts/set-macos-display-name.ts",
    postWrap: "./scripts/set-macos-display-name.ts",
  },
} satisfies ElectrobunConfig;
