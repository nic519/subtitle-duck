import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { downloadVerifiedFile, createManagedWhisper } from "./managedWhisper";

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function directory() { const dir = await mkdtemp(join(tmpdir(), "duck-managed-")); dirs.push(dir); return dir; }
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

test("损坏下载不能替换正式文件，重试后只复用已校验文件", async () => {
  const path = join(await directory(), "model.bin");
  let requests = 0;
  const fetcher = async () => { requests++; return new Response(requests === 1 ? "bad" : "model"); };
  const input = { url: "https://example.com/model", path, sha256: sha("model"), signal: new AbortController().signal, fetcher };
  await expect(downloadVerifiedFile(input)).rejects.toThrow();
  expect(await Bun.file(path).exists()).toBe(false);
  await downloadVerifiedFile(input);
  await downloadVerifiedFile(input);
  expect(await readFile(path, "utf8")).toBe("model");
  expect(requests).toBe(2);
});

test("取消下载不能留下可用文件", async () => {
  const path = join(await directory(), "model.bin");
  const controller = new AbortController();
  controller.abort();
  await expect(downloadVerifiedFile({ url: "https://example.com", path, sha256: sha("model"), signal: controller.signal, fetcher: async () => new Response("model") })).rejects.toThrow();
  expect(await Bun.file(path).exists()).toBe(false);
});

test("后台任务互斥，安装失败不覆盖手动配置且可重试", async () => {
  const saved: string[] = [];
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const manager = createManagedWhisper({ root: await directory(), savePython: async path => { saved.push(path); }, bootstrapUv: async () => { await blocked; throw new Error("离线"); } });
  manager.start({ kind: "install" });
  expect(() => manager.start({ kind: "install" })).toThrow();
  release();
  while ((await manager.snapshot()).task.state === "running") await Bun.sleep(5);
  expect((await manager.snapshot()).task.state).toBe("error");
  expect(saved).toEqual([]);
  expect(() => manager.start({ kind: "install" })).not.toThrow();
  while ((await manager.snapshot()).task.state === "running") await Bun.sleep(5);
});

test("未知模型和路径穿越在启动下载前拒绝", async () => {
  const manager = createManagedWhisper({ root: await directory(), savePython: async () => {} });
  expect(() => manager.start({ kind: "model", modelId: "../../outside" })).toThrow();
  expect((await manager.snapshot()).task.state).toBe("idle");
});

test("优先复用本地 uv，不要求用户安装应用专用副本", async () => {
  const { detectLocalUv } = await import("./managedWhisper");
  const uv = await detectLocalUv(async () => "uv 0.8.15\n");
  expect(uv?.source).toBe("local");
  expect(uv?.version).toBe("uv 0.8.15");
});

test("本地 uv 无法运行或版本过旧时允许回退", async () => {
  const { detectLocalUv } = await import("./managedWhisper");
  expect(await detectLocalUv(async () => { throw new Error("ENOENT"); })).toBeNull();
  expect(await detectLocalUv(async () => "uv 0.1.1")).toBeNull();
});

test("模型下载固定仓库版本，成功后可选但不自动覆盖配置", async () => {
  const saved: string[] = [];
  const revision = "a".repeat(40);
  const files: Record<string, string> = { "model.bin": "weights", "config.json": "{}", "tokenizer.json": "{}", "vocabulary.txt": "token" };
  const manager = createManagedWhisper({
    root: await directory(), savePython: async path => { saved.push(path); },
    fetcher: async (url: string) => {
      if (url.includes("/api/models/")) return Response.json({ sha: revision, siblings: Object.entries(files).map(([rfilename, content]) => ({ rfilename, blobId: "", lfs: { sha256: sha(content) } })) });
      expect(url).toContain(`/resolve/${revision}/`);
      return new Response(files[url.split("/").at(-1)!]);
    },
  });
  manager.start({ kind: "model", modelId: "tiny" });
  while ((await manager.snapshot()).task.state === "running") await Bun.sleep(5);
  const snapshot = await manager.snapshot();
  expect(snapshot.task.state).toBe("done");
  expect(snapshot.models.map(model => model.id)).toEqual(["tiny"]);
  expect(await readFile(join(snapshot.models[0]!.path, "model.bin"), "utf8")).toBe("weights");
  expect(saved).toEqual([]);
  // 完成标记不能掩盖丢失的文件，重新下载应修复目录。
  await rm(join(snapshot.models[0]!.path, "vocabulary.txt"));
  expect((await manager.snapshot()).models).toEqual([]);
  manager.start({ kind: "model", modelId: "tiny" });
  while ((await manager.snapshot()).task.state === "running") await Bun.sleep(5);
  expect((await manager.snapshot()).task.state).toBe("done");
  expect((await manager.snapshot()).models.map(model => model.id)).toEqual(["tiny"]);
});

test("拒绝不在允许列表内的依赖源", async () => {
  const manager = createManagedWhisper({ root: await directory(), savePython: async () => {} });
  // RPC 输入是运行时数据，即使绕过 TypeScript 也不能注入任意下载源。
  // @ts-expect-error 验证不合法的外部输入
  expect(() => manager.start({kind:"install",source:"https://unknown.example"})).toThrow("未知依赖下载源");
  expect((await manager.snapshot()).task.state).toBe("idle");
});

// 删除只接收已知模型 ID；不允许删除当前配置或越界目录。
test("删除托管模型及下载残留，保护当前模型和外部路径", async () => {
  const root = await directory();
  const target = join(root, "models", "tiny");
  let modelPath = target;
  for (const path of [target, `${target}.download`, `${target}.previous`]) {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "model.bin"), "weights");
  }
  const manager = createManagedWhisper({ root, savePython: async () => {}, getConfig: async () => ({ pythonPath: "python3", modelPath }) });
  expect(() => manager.start({ kind: "delete", modelId: "../../outside" })).toThrow();
  manager.start({ kind: "delete", modelId: "tiny" });
  while ((await manager.snapshot()).task.state === "running") await Bun.sleep(5);
  expect((await manager.snapshot()).task.state).toBe("error");
  expect(await Bun.file(join(target, "model.bin")).exists()).toBe(true);
  modelPath = "";
  manager.start({ kind: "delete", modelId: "tiny" });
  expect(() => manager.start({ kind: "model", modelId: "tiny" })).toThrow();
  while ((await manager.snapshot()).task.state === "running") await Bun.sleep(5);
  expect((await manager.snapshot()).task.state).toBe("done");
  for (const path of [target, `${target}.download`, `${target}.previous`]) expect(await Bun.file(join(path, "model.bin")).exists()).toBe(false);
});

// 使用分块响应验证后台产生速率，而非只验证前端格式化。
test("下载流产生实际速度，完成后清除速度", async () => {
  const files: Record<string, string> = { "model.bin": "weights", "config.json": "{}", "tokenizer.json": "{}", "vocabulary.txt": "token" };
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const manager = createManagedWhisper({ root: await directory(), savePython: async () => {}, fetcher: async url => {
    if (url.includes("/api/models/")) return Response.json({ sha: "a".repeat(40), siblings: Object.entries(files).map(([rfilename, content]) => ({ rfilename, lfs: { sha256: sha(content) } })) });
    const name = url.split("/").at(-1)!;
    const data = new TextEncoder().encode(files[name]);
    if (name !== "model.bin") return new Response(data);
    return new Response(new ReadableStream({ async start(stream) {
      stream.enqueue(data);
      await gate;
      stream.close();
    }}), { headers: { "content-length": String(data.length) } });
  }});
  manager.start({ kind: "model", modelId: "tiny" });
  try {
    let speed = 0;
    for (let i = 0; i < 100; i++) {
      speed = (await manager.snapshot()).task.bytesPerSecond ?? 0;
      if (speed > 0) break;
      await Bun.sleep(5);
    }
    expect(speed).toBeGreaterThan(0);
  } finally { release(); }
  while ((await manager.snapshot()).task.state === "running") await Bun.sleep(5);
  expect((await manager.snapshot()).task.state).toBe("done");
  expect((await manager.snapshot()).task.bytesPerSecond).toBeNull();
});
