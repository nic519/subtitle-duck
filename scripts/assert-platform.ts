const expectedPlatform = Bun.argv[2];

const platformAliases: Record<string, NodeJS.Platform> = {
  mac: "darwin",
  macos: "darwin",
  darwin: "darwin",
  windows: "win32",
  win: "win32",
  win32: "win32",
};

const expected = expectedPlatform ? platformAliases[expectedPlatform] : undefined;

if (!expected) {
  console.error("Usage: bun scripts/assert-platform.ts <macos|windows>");
  process.exit(1);
}

if (process.platform !== expected) {
  console.error(`This package script must run on ${expectedPlatform}.`);
  process.exit(1);
}
