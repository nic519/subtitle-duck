import type { ElectrobunConfig } from "electrobun";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default {
  app: { name: "字幕鸭", identifier: "com.subtitleduck.app", version: packageJson.version },
  runtime: { exitOnLastWindowClosed: true },
  build: {
    bun: { entrypoint: "src/desktop/index.ts" },
    watchIgnore: ["dist/**"],
    copy: { dist: "views/main" },
    mac: { icons: "assets/app-icon.iconset", bundleCEF: false },
    linux: { icon: "assets/app-icon.png", bundleCEF: false },
    win: { icon: "assets/app-icon.ico", bundleCEF: false },
  },
  scripts: {
    postBuild: "./scripts/set-macos-display-name.ts",
    postWrap: "./scripts/set-macos-display-name.ts",
  },
} satisfies ElectrobunConfig;
