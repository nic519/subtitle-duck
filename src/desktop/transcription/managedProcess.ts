// 安装器的网络请求超时不等于进程总超时。这里独立监督整个子进程，
// 无日志活动和总时长分别限时，取消/超时后先 TERM，再 KILL，确保释放后台任务。
export async function runManagedProcess(args: string[], options: {
  signal: AbortSignal; env?: Record<string, string | undefined>;
  onOutput?: (text: string) => void;
  idleTimeoutMs?: number; timeoutMs?: number; killGraceMs?: number;
}): Promise<string> {
  options.signal.throwIfAborted();
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", env: options.env });
  let failure: Error | null = null;
  let idleTimer: ReturnType<typeof setTimeout>;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = (reason: Error) => {
    if (failure) return;
    failure = reason;
    child.kill("SIGTERM");
    killTimer = setTimeout(() => child.kill("SIGKILL"), options.killGraceMs ?? 1500);
  };
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => stop(new Error("安装进程长时间没有新输出，已停止。请检查网络后重试，已下载缓存会保留。")), options.idleTimeoutMs ?? 180_000);
  };
  const onAbort = () => stop(options.signal.reason instanceof Error ? options.signal.reason : new Error("已取消"));
  options.signal.addEventListener("abort", onAbort, { once: true });
  const totalTimer = setTimeout(() => stop(new Error("安装进程超过总时限，已停止。请检查网络后重试。")), options.timeoutMs ?? 600_000);
  resetIdle();
  const read = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader(); const decoder = new TextDecoder(); let output = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        output = (output + text).slice(-12_000);
        if (!failure) resetIdle();
        options.onOutput?.(text);
      }
      return output;
    } finally { reader.releaseLock(); }
  };
  try {
    const [stdout, stderr, code] = await Promise.all([read(child.stdout), read(child.stderr), child.exited]);
    if (failure) throw failure;
    if (code !== 0) throw new Error(stderr.trim() || stdout.trim() || `进程退出 ${code}`);
    return stdout;
  } finally {
    clearTimeout(idleTimer!); clearTimeout(totalTimer); clearTimeout(killTimer);
    options.signal.removeEventListener("abort", onAbort);
  }
}
