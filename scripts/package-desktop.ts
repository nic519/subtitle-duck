const channel = Bun.argv[2] ?? "stable";

if (process.platform === "darwin") {
  const result = Bun.spawnSync([
    process.execPath,
    "scripts/package-macos-app.ts",
    channel,
  ], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(result.exitCode);
}

if (process.platform === "win32") {
  console.log("Electrobun Windows release artifacts created.");
  process.exit(0);
}

console.error(`Unsupported packaging platform: ${process.platform}`);
process.exit(1);
