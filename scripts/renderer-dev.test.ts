import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

test("开发服务器能通过 React 插件编译真实渲染入口", async () => {
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: { port: 0 } },
    optimizeDeps: { disabled: true },
  });
  try {
    const result = await server.transformRequest("/src/main.tsx");
    expect(result?.code).toContain("createRoot");
  } finally {
    await server.close();
  }
});
