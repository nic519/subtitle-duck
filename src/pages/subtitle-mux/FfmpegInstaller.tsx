import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { ToolbarButton, ToolbarIconButton } from "@/components/page-ui";
import type { FfmpegInstallStatus } from "../../desktop/ffmpeg/managedFfmpeg";

const loadApi = async () => (await import("../../desktop/client")).desktopApi;

// 任务在主进程运行；页面重开后恢复状态，多处安装入口共享同一任务。
export function FfmpegInstaller({ darkMode, onRefresh }: {
  darkMode: boolean; onRefresh: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<FfmpegInstallStatus | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  const desktop = typeof window !== "undefined" && Boolean(window.__electrobun);
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let finished = false;
    const poll = async () => {
      try {
        const next = await (await loadApi()).getFfmpegInstallStatus();
        if (disposed) return;
        setStatus(next);
        if (next.state === "done" && !finished) { finished = true; await refresh.current(); }
        if (next.state !== "done") finished = false;
      } catch (reason) { if (!disposed) setError(String(reason)); }
      finally { if (!disposed) timer = setTimeout(poll, 800); }
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [desktop]);
  const busy = pending || status?.state === "running";
  return <div className="mt-3 grid min-w-0 gap-2 text-[length:var(--font-size-caption)]" data-ffmpeg-installer>
    <div className="flex items-center gap-2">
      <ToolbarButton darkMode={darkMode} disabled={busy || !desktop} onClick={async () => {
        setPending(true); setError("");
        try {
          const api = await loadApi();
          await api.installFfmpeg();
          setStatus(await api.getFfmpegInstallStatus());
        } catch (reason) { setError(String(reason)); }
        finally { setPending(false); }
      }}><Download className="size-3.5" />{busy ? "正在安装" : "安装 FFmpeg"}</ToolbarButton>
      <ToolbarIconButton darkMode={darkMode} disabled={busy} title="重新检测 FFmpeg" aria-label="重新检测 FFmpeg" onClick={() => void onRefresh()}><RefreshCw className="size-3.5" /></ToolbarIconButton>
      {busy && <button className="ml-auto underline" onClick={() => void loadApi().then(api => api.cancelFfmpegInstall()).catch(reason => setError(String(reason)))}>取消</button>}
    </div>
    {status?.state === "running" && <>
      <p role="status">{status.message}{status.percent !== null ? ` · ${status.percent}%` : ""}</p>
      <progress className="h-1.5 w-full" aria-label="FFmpeg 安装进度" max={100} value={status.percent ?? undefined} />
    </>}
    {(status?.state === "error" || status?.state === "cancelled") && <p role="alert" className="break-words text-[var(--status-error-text)]">{status.message}</p>}
    {error && <p role="alert" className="break-words text-[var(--status-error-text)]">{error}</p>}
  </div>;
}
