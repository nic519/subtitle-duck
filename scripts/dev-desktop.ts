const rendererUrl = "http://127.0.0.1:1420";

const vite = Bun.spawn([
  process.execPath,
  "node_modules/vite/bin/vite.js",
  "--host",
  "127.0.0.1",
], {
  cwd: process.cwd(),
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const waitForRenderer = async () => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(rendererUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await Bun.sleep(100);
  }
  throw new Error("Vite 开发服务器未能在 20 秒内启动");
};

let desktop: ReturnType<typeof Bun.spawn> | null = null;
let stopping = false;

const stop = () => {
  if (stopping) return;
  stopping = true;
  desktop?.kill("SIGINT");
  vite.kill("SIGINT");
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  await waitForRenderer();
  desktop = Bun.spawn(["node_modules/electrobun/bin/electrobun", "dev", "--watch"], {
    cwd: process.cwd(),
    env: { ...process.env, ELECTROBUN_RENDERER_URL: rendererUrl },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await Promise.race([vite.exited, desktop.exited]);
  stop();
  process.exit(exitCode);
} catch (error) {
  stop();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
