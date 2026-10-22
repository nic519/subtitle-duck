import { expect, test } from "bun:test";
import { runManagedProcess } from "./managedProcess";

test("无输出进程超时后强制退出，不让任务一直占用安装按钮", async () => {
  const started = Date.now();
  await expect(runManagedProcess([process.execPath, "-e", "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"], {
    signal: new AbortController().signal, idleTimeoutMs: 150, timeoutMs: 2000, killGraceMs: 30,
  })).rejects.toThrow("没有新输出");
  expect(Date.now() - started).toBeLessThan(1500);
});

test("持续输出仍受总超时限制，并实时返回下载活动", async () => {
  const output: string[] = [];
  await expect(runManagedProcess([process.execPath, "-e", "setInterval(()=>console.error('Downloading numpy'),20)"], {
    signal: new AbortController().signal, idleTimeoutMs: 1000, timeoutMs: 180, killGraceMs: 30,
    onOutput: text => output.push(text),
  })).rejects.toThrow("总时限");
  expect(output.join("")).toContain("Downloading numpy");
});

test("取消会终止静默进程并返回取消原因", async () => {
  const controller = new AbortController();
  const promise = runManagedProcess([process.execPath, "-e", "setInterval(()=>{},1000)"], { signal: controller.signal, killGraceMs: 30 });
  controller.abort(new Error("用户取消"));
  await expect(promise).rejects.toThrow("用户取消");
});

test("正常结束保留 stdout，非零退出显示 stderr", async () => {
  expect(await runManagedProcess([process.execPath,"-e","console.log('ready')"], {signal:new AbortController().signal})).toBe("ready\n");
  await expect(runManagedProcess([process.execPath,"-e","console.error('network failed');process.exit(1)"], {signal:new AbortController().signal})).rejects.toThrow("network failed");
});
