import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

async function runFixture(wrapped: boolean) {
  const root = mkdtempSync(path.join(os.tmpdir(), "subtitle-duck-payload-"));
  try {
    const files: Record<string, string> = wrapped
      ? { "subtitle-duck/bin/launcher.exe": "extractor", "subtitle-duck/Resources/metadata.json": "{}" }
      : {
          "subtitle-duck/bin/launcher.exe": "real launcher",
          "subtitle-duck/bin/bun.exe": "runtime",
          "subtitle-duck/Resources/version.json": "{}",
          "subtitle-duck/Resources/main.js": "bootstrap",
          "subtitle-duck/Resources/app/bun/index.js": "app",
          "subtitle-duck/Resources/app/views/main/index.html": "view",
        };
    mkdirSync(path.join(root, "artifacts"));
    const archive = new Bun.Archive(files);
    await Bun.write(path.join(root, "artifacts/stable-win-x64-subtitle-duck.tar.zst"), Bun.zstdCompressSync(await archive.bytes()));
    const proc = Bun.spawn([process.execPath, path.resolve(import.meta.dir, "prepare-windows-payload.ts")], {
      cwd: root, stdout: "pipe", stderr: "pipe",
    });
    const code = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    if (wrapped) {
      expect(code).not.toBe(0);
      expect(stderr).toContain("Missing application payload file");
    } else {
      expect(stderr).toBe("");
      expect(code).toBe(0);
      const source = (await Bun.file(path.join(root, "portable-work/source-dir.txt")).text()).trim();
      expect(await Bun.file(path.join(source, "bin/launcher.exe")).text()).toBe("real launcher");
      expect(await Bun.file(path.join(source, "Resources/app/views/main/index.html")).text()).toBe("view");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("extracts the runnable app from the release archive", () => runFixture(false));
test("rejects the outer installer wrapper even when launcher.exe exists", () => runFixture(true));
