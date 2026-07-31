import {
  DEV_SERVER_HOST,
  DEV_SERVER_URL,
} from "../dev-server.config";

const electrobun = Bun.which("electrobun");
if (!electrobun) {
  throw new Error("Electrobun CLI 未安装，请先运行 bun install");
}

const vite = Bun.spawn([
  process.execPath,
  "node_modules/vite/bin/vite.js",
  "--host",
  DEV_SERVER_HOST,
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
      const response = await fetch(DEV_SERVER_URL);
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
  desktop = Bun.spawn([electrobun, "dev", "--watch"], {
    cwd: process.cwd(),
    env: { ...process.env, ELECTROBUN_RENDERER_URL: DEV_SERVER_URL },
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
