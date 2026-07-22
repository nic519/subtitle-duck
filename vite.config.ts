import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string };

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    base: "./",
    clearScreen: false,
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __APP_UPDATE_FEED_URL__: JSON.stringify(
        env.VITE_APP_UPDATE_FEED_URL ?? ""
      ),
    },
    server: {
      port: 1420,
      watch: {
        ignored: ["**/build/**", "**/dist/**"],
      },
    },
    envPrefix: ["VITE_"],
    build: {
      target: "es2020",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
