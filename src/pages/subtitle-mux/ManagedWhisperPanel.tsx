import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, LoaderCircle } from "lucide-react";
// 展示组件可在测试/静态渲染中加载；只有客户端交互才加载 Electrobun SDK。
const loadApi = async () => (await import("../../desktop/client")).desktopApi;
const isDesktop = typeof window !== "undefined" && Boolean(window.__electrobun);
import type { ManagedWhisperRequest, ManagedWhisperSnapshot } from "../../desktop/transcription/managedWhisper";
import { fasterWhisperModels } from "../../subtitle-mux/fasterWhisperModels";
import { ToolbarButton, ToolbarIconButton } from "@/components/page-ui";

// 后台任务属于桌面进程；切换页面后通过快照恢复，组件卸载不会取消下载。
export function ManagedWhisperPanel({ darkMode, disabled, currentModel, onUseModel, onEnvironmentChanged, onLogChanged }: {
  darkMode: boolean; disabled: boolean; currentModel: string | null;
  onUseModel: (path: string) => void | Promise<void>;
  onEnvironmentChanged: (python: string) => void | Promise<void>;
  onLogChanged: (log: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<ManagedWhisperSnapshot | null>(null);
  const [packageSource, setPackageSource] = useState<"pypi" | "tuna">("tuna");
  const [modelId, setModelId] = useState("large-v3");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const onLog = useRef(onLogChanged);
  onLog.current = onLogChanged;
  const onModel = useRef(onUseModel);
  onModel.current = onUseModel;
  const onChanged = useRef(onEnvironmentChanged);
  onChanged.current = onEnvironmentChanged;
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastPython: string | null = null;
    let lastTaskState = "idle";
    const poll = async () => {
      try {
        const next = await (await loadApi()).getManagedWhisper();
        if (disposed) return;
        setSnapshot(next);
        setNow(Date.now());
        onLog.current(next?.task.log ?? "");
        if (next?.pythonPath && (next.pythonPath !== lastPython || (next.task.state === "done" && lastTaskState !== "done"))) {
          lastPython = next.pythonPath;
          // 回读当前配置，不把手动选择偷偷切换成托管环境。
          const configured = await (await loadApi()).configGet("faster_whisper_python_path");
          if (!disposed && configured) await onChanged.current(configured);
          const configuredModel = await (await loadApi()).configGet("faster_whisper_model_path");
          if (!disposed && configuredModel) await onModel.current(configuredModel);
        }
        lastTaskState = next?.task.state ?? "idle";
      } catch (reason) { if (!disposed) setError(String(reason)); }
      finally { if (!disposed) timer = setTimeout(poll, 1200); }
    };
    void poll();
    void loadApi().then(api => api.detectWhisperUv()).then(next => { if (!disposed && next) setSnapshot(next); }).catch(reason => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; clearTimeout(timer); };
  }, []);
  const busy = snapshot?.task.state === "running" || pending;
  const model = snapshot?.models.find(item => item.id === modelId);
  const start = async (request: ManagedWhisperRequest) => {
    setError(""); setPending(true);
    try {
      await (await loadApi()).startManagedWhisper(request);
      setSnapshot(await (await loadApi()).getManagedWhisper());
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setPending(false); }
  };
  return <div className="mt-4 grid min-w-0 gap-3 text-[length:var(--font-size-caption)]" data-managed-whisper>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="grid min-w-0 content-start gap-2">
        <div className="flex items-center gap-2">
          <ReadinessStatus label="faster-whisper" ready={Boolean(snapshot?.components?.whisper.ready)} pending={!snapshot?.components} missing="待安装" />
          <ToolbarIconButton darkMode={darkMode} className="ml-auto h-7 w-7" disabled={busy || detecting || !isDesktop} title="重新检测环境" aria-label="重新检测环境" onClick={async () => {
            setDetecting(true); setError("");
            try { setSnapshot(await (await loadApi()).detectWhisperUv()); } catch (reason) { setError(String(reason)); } finally { setDetecting(false); }
          }}><RefreshCw className={`size-3.5 ${detecting ? "animate-spin" : ""}`} /></ToolbarIconButton>
        </div>
        <label className="flex items-center gap-2 text-muted-foreground">依赖下载源
          <select aria-label="依赖下载源" value={packageSource} disabled={busy} onChange={event => setPackageSource(event.target.value as "pypi" | "tuna")} className="h-7 min-w-0 flex-1 rounded border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2 text-foreground">
            <option value="pypi">官方 PyPI</option><option value="tuna">清华镜像</option>
          </select>
        </label>
        <ToolbarButton darkMode={darkMode} disabled={busy || disabled || !isDesktop} onClick={() => void start({ kind: "install", source: packageSource })}>
          <Download className="size-3.5" />{snapshot?.components?.whisper.ready ? "重新安装" : "安装 faster-whisper"}
        </ToolbarButton>
      </div>
      <div className="grid min-w-0 content-start gap-2">
        <label className="flex min-h-7 items-center gap-2 font-medium">下载模型
          <select aria-label="托管下载模型" value={modelId} onChange={event => setModelId(event.target.value)} className="h-7 min-w-0 flex-1 rounded border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2 text-foreground">
            {fasterWhisperModels.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <p className="text-muted-foreground">{model ? "已下载" : "未下载"}</p>
        {model ? <ToolbarButton darkMode={darkMode} disabled={disabled || busy || currentModel === model.path} onClick={async () => {
          try { setError(""); await onUseModel(model.path); } catch (reason) { setError(String(reason)); }
        }}>{currentModel === model.path ? "正在使用" : "使用此模型"}</ToolbarButton> : <ToolbarButton darkMode={darkMode} disabled={busy || !isDesktop} onClick={() => void start({ kind: "model", modelId })}><Download className="size-3.5" />下载模型</ToolbarButton>}
      </div>
    </div>
    <ToolbarButton darkMode={darkMode} disabled={busy || disabled || !isDesktop} className="subtitle-accent-action" onClick={() => void start({kind:"prepare",modelId,source:packageSource})}>
      <Download className="size-3.5" />一键准备 · {fasterWhisperModels.find(item => item.id === modelId)?.label}
    </ToolbarButton>
    {!isDesktop && <p className="text-muted-foreground">请在桌面应用中安装和下载。</p>}
    {snapshot?.task.message && snapshot.task.state !== "done" && <div className="flex min-w-0 items-start gap-2" role="status" aria-live="polite">
      <span className={`min-w-0 flex-1 break-words ${snapshot.task.state === "error" ? "text-[var(--status-error-text)]" : "text-muted-foreground"}`}>{snapshot.task.message}{snapshot.task.percent !== null ? ` ${snapshot.task.percent}%` : ""}</span>
      {busy && <button className="shrink-0 underline" onClick={() => void loadApi().then(api => api.cancelManagedWhisper()).catch(reason => setError(String(reason)))}>取消</button>}
    </div>}
    {snapshot && <ManagedWhisperTaskProgress task={snapshot.task} now={now} />}
    {error && <p role="alert" className="break-words text-[var(--status-error-text)]">{error}</p>}
  </div>;
}

// 安装依赖时没有可靠的百分比，展示真实时长和最近活动，不让用户把静默等待误认为无响应。
export function ManagedWhisperTaskProgress({ task, now }: { task: ManagedWhisperSnapshot["task"]; now: number }) {
  if (task.state !== "running") return null;
  const elapsed = task.startedAt ? Math.max(0, Math.floor((now - task.startedAt) / 1000)) : 0;
  const quiet = task.lastActivityAt ? Math.max(0, Math.floor((now - task.lastActivityAt) / 1000)) : 0;
  return <div className="grid gap-1.5 text-muted-foreground">
    <div className="flex items-center gap-2"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
      <span>处理中{task.startedAt ? ` · 已用 ${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒` : ""}</span>
    </div>
    <progress aria-label={task.percent == null ? "正在处理，进度未知" : "当前文件下载进度"} className="h-1.5 w-full" max={100} value={task.percent ?? undefined} />
    {task.activity && <p className="break-all">最近活动：{task.activity}</p>}
    {quiet >= 45 && <p role="status">已 {quiet} 秒没有新输出，可能在等待网络。安装进程连续 3 分钟无输出会自动停止；可取消后切换依赖下载源重试。</p>}
  </div>;
}

export function ReadinessStatus({label,ready,detail,pending,missing}:{label:string;ready:boolean;detail?:string|null;pending?:boolean;missing:string}) {
  return <div className="min-w-0 border-l-2 border-[var(--subtitle-accent-border)] pl-2">
    <div className="font-medium">{label}</div>
    <div className={`break-words ${ready ? "text-[var(--status-success-text)]" : "text-muted-foreground"}`}>
      {pending ? "检测中" : ready ? `已就绪${detail ? ` · ${detail}` : ""}` : missing}
    </div>
  </div>;
}
