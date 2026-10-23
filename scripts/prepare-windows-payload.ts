import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// Release builds replace build/.../bin/launcher.exe with the installer extractor.
// Only the update archive contains the runnable application that Inno must install.
const archivePath = path.resolve("artifacts/stable-win-x64-subtitle-duck.tar.zst");
const workDir = path.resolve("portable-work");
const payloadDir = path.join(workDir, "payload");
const sourceDir = path.join(payloadDir, "subtitle-duck");
const sourceFile = path.join(workDir, "source-dir.txt");
mkdirSync(workDir, { recursive: true });
rmSync(sourceFile, { force: true });
rmSync(payloadDir, { recursive: true, force: true });
const archive = new Bun.Archive(Bun.zstdDecompressSync(await Bun.file(archivePath).bytes()));
await archive.extract(payloadDir);

for (const file of [
  "bin/launcher.exe",
  "bin/bun.exe",
  "Resources/version.json",
  "Resources/main.js",
  "Resources/app/bun/index.js",
  "Resources/app/views/main/index.html",
]) {
  if (!existsSync(path.join(sourceDir, file))) {
    throw new Error(`Missing application payload file: ${file}. Refusing to package an installer wrapper.`);
  }
}
writeFileSync(sourceFile, sourceDir);
console.log(`Windows application payload: ${sourceDir}`);
