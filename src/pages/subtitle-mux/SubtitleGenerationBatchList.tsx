import { VideoInfo } from "@/components/video-info/VideoInfo";
import { ToolbarButton } from "@/components/page-ui";
import type { SubtitleGenerationBatchSnapshot } from "../../subtitle-mux/subtitleGenerationBatch";

const statusLabels = { pending: "等待生成", reading: "读取中", running: "生成中", completed: "已完成", failed: "失败", stopped: "已停止" };

/** 列表负责队列操作，视频信息独立成行，不嵌入文件选择控件。 */
export const SubtitleGenerationBatchList = ({ batch, darkMode, onRemove, onReveal }: {
  batch: SubtitleGenerationBatchSnapshot;
  darkMode: boolean;
  onRemove: (path: string) => void;
  onReveal: (path: string) => void | Promise<void>;
}) => (
  <div className="grid min-w-0 gap-3" data-subtitle-generation-batch="true">
    <div className="text-[length:var(--font-size-caption)] text-muted-foreground">
      共 {batch.items.length} 个视频 · 已完成 {batch.items.filter(item => item.status === "completed").length} 个
    </div>
    <ul className="grid min-w-0 divide-y divide-white/10">
      {batch.items.map(item => (
        <li key={item.path} className="grid min-w-0 gap-2 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span title={item.path} className="min-w-0 flex-1 truncate text-[length:var(--font-size-control)]">{item.path.split(/[\\/]/).pop()}</span>
            <span role="status" className={`text-[length:var(--font-size-caption)] ${item.status === "failed" ? "text-[var(--status-error-text)]" : "text-muted-foreground"}`}>
              {statusLabels[item.status]}{item.status === "running" && item.percent !== null ? ` ${Math.round(item.percent)}%` : ""}
            </span>
            {item.outputPath ? <ToolbarButton darkMode={darkMode} onClick={() => void onReveal(item.outputPath!)}>打开字幕</ToolbarButton> : null}
            <ToolbarButton darkMode={darkMode} disabled={batch.running} onClick={() => onRemove(item.path)}>移除</ToolbarButton>
          </div>
          <VideoInfo videoPath={item.path} />
          {item.status === "failed" && item.message ? <p className="break-all text-[length:var(--font-size-caption)] text-[var(--status-error-text)]">{item.message}</p> : null}
          {item.outputPath ? <p className="break-all text-[length:var(--font-size-caption)] text-muted-foreground">{item.outputPath}</p> : null}
        </li>
      ))}
    </ul>
  </div>
);
