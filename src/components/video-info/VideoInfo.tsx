import { useEffect, useState } from "react";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import type { VideoMetadata } from "../../desktop/videoMetadata";
import { formatSubtitleRangeTime } from "../../subtitle-mux/subtitleGenerationRange";

const bitRate = (value: number | null) => value === null ? "未知" : value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)} Mbps` : `${Math.round(value / 1000)} kbps`;
const fileSize = (value: number | null) => value === null ? "未知" : value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GiB` : `${(value / 1024 ** 2).toFixed(1)} MiB`;

/** 只负责展示探测结果，可用于其他视频上传/选择控件。 */
export const VideoInfoDetails = ({ info }: { info: VideoMetadata }) => {
  const fields = [
    ["分辨率", info.width && info.height ? `${info.width} × ${info.height}` : "未知"],
    ["编码", info.videoCodec?.toUpperCase() ?? "未知"],
    ["帧率", info.frameRate === null ? "未知" : `${Number(info.frameRate.toFixed(3))} fps`],
    ["视频码率", bitRate(info.videoBitRate)],
    ["总码率", bitRate(info.totalBitRate)],
    ["时长", info.durationMs === null ? "未知" : formatSubtitleRangeTime(info.durationMs)],
    ["大小", fileSize(info.sizeBytes)],
    ["音频", info.audioCodec ? [info.audioCodec.toUpperCase(), info.audioSampleRate ? `${info.audioSampleRate / 1000} kHz` : null, info.audioChannels ? `${info.audioChannels} 声道` : null].filter(Boolean).join(" · ") : "无音轨或未知"],
  ];
  return (
    <div className="grid gap-1" data-video-info="ready">
      <div className="flex items-center gap-1 text-[var(--status-success-text)]"><CircleCheck className="size-3.5" />已读取视频信息</div>
      <dl className="flex flex-wrap gap-x-3 gap-y-1">
        {fields.map(([label, value]) => <div key={label} className="flex gap-1"><dt>{label}</dt><dd className="text-foreground">{value}</dd></div>)}
      </dl>
    </div>
  );
};

type Result = { path: string; info?: VideoMetadata; error?: string };

/** 以路径为唯一输入；换文件或卸载后忽略旧请求，避免把上个视频的信息展示给新文件。 */
export const VideoInfo = ({ videoPath }: { videoPath: string | null }) => {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!videoPath) {
      setResult(null);
      return;
    }
    let disposed = false;
    setResult(null);
    // 延迟加载桌面桥接，展示控件本身不依赖桌面全局对象。
    void import("../../desktop/client")
      .then(({ desktopApi }) => desktopApi.getVideoMetadata(videoPath))
      .then((info) => { if (!disposed) setResult({ path: videoPath, info }); })
      .catch((error: unknown) => {
        if (!disposed) setResult({ path: videoPath, error: error instanceof Error ? error.message : String(error) });
      });
    return () => { disposed = true; };
  }, [videoPath]);

  if (!videoPath) return null;
  const current = result?.path === videoPath ? result : null;
  return (
    <div role="status" className="min-w-0 text-[length:var(--font-size-caption)] text-muted-foreground">
      {current?.info ? <VideoInfoDetails info={current.info} /> : current?.error ? (
        <div className="flex items-start gap-1 text-[var(--status-error-text)]"><CircleX className="mt-0.5 size-3.5 shrink-0" /><span className="break-all">无法读取视频信息：{current.error}</span></div>
      ) : <div className="flex items-center gap-1"><LoaderCircle className="size-3.5 animate-spin" />正在读取视频信息…</div>}
    </div>
  );
};
