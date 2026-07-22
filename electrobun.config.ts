import type { ElectrobunConfig } from "electrobun";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default {
  // Bun.Archive, used by Electrobun's stable updater bundle, cannot archive
  // non-ASCII paths. The macOS post-build hook still sets the visible name to “字幕鸭”.
  app: { name: "subtitle-duck", identifier: "com.subtitleduck.app", version: packageJson.version },
  runtime: { exitOnLastWindowClosed: true },
  build: {
    bun: { entrypoint: "src/desktop/index.ts" },
    watchIgnore: ["dist/**"],
    copy: { dist: "views/main" },
    mac: {
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
