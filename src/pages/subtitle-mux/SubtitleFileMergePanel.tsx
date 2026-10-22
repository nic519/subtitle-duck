import { useEffect, useRef, useState } from 'react';
import { Captions, Combine } from 'lucide-react';
import { FilePathPicker } from '@/components/file-path-picker/FilePathPicker';
import { ToolbarButton, StatusMessage } from '@/components/page-ui';
import { formatSubtitleRangeTime } from '../../subtitle-mux/subtitleGenerationRange';
import type { MergeSubtitleFilesResult } from '../../desktop/subtitles/mergeSubtitleFiles';

// 延迟加载桌面桥接，静态渲染和浏览器预览不需要启动桌面运行时。
const loadApi = async () => (await import('../../desktop/client')).desktopApi;

// 合并独立于识别环境：没有视频、模型或生成结果时也能手动选择两份字幕。
export function SubtitleFileMergePanel({darkMode, generatedSubtitlePath, disabled = false}: {
  darkMode: boolean; generatedSubtitlePath: string | null; disabled?: boolean;
}) {
  const [partialPath, setPartialPath] = useState<string | null>(null);
  const [basePath, setBasePath] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MergeSubtitleFilesResult | null>(null);
  const inFlight = useRef(false);
  // 未手动选择 A 时带入最近生成结果；手动选定后不随下一次生成悄悄更换。
  const selectedPartial = partialPath ?? generatedSubtitlePath ?? '';
  const busy = pending || disabled;
  useEffect(() => { setResult(null); setError(''); }, [selectedPartial, basePath]);

  const choose = async (target: 'partial' | 'base') => {
    try {
      const path = await (await loadApi()).selectSubtitleTranslationFile();
      if (path) (target === 'partial' ? setPartialPath : setBasePath)(path);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const merge = async () => {
    if (inFlight.current || busy || !selectedPartial || !basePath) return;
    inFlight.current = true;
    setPending(true); setResult(null); setError('');
    try { setResult(await (await loadApi()).mergeSubtitleFiles({partialPath: selectedPartial, basePath})); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { inFlight.current = false; setPending(false); }
  };
  const reveal = async () => {
    if (!result) return;
    try { await (await loadApi()).revealFilePath(result.outputPath); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return <div className="grid min-w-0 gap-3" data-subtitle-file-merge>
    <p className="text-[length:var(--font-size-caption)] leading-relaxed text-muted-foreground">
      A、B 均须为原视频时间的 SRT。用 A 最早开始到最晚结束的整段内容覆盖 B（包含中间空隙），保留 B 其余部分；结果另存到 B 所在目录。
    </p>
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      {(['partial', 'base'] as const).map(target => {
        const isPartial = target === 'partial';
        const label = isPartial ? '局部字幕 A' : '完整字幕 B';
        const update = isPartial ? setPartialPath : setBasePath;
        return <FilePathPicker key={target} id={`subtitle-file-merge-${target}`} darkMode={darkMode}
          label={label} icon={<Captions className="size-4" />} selectedPath={isPartial ? selectedPartial : basePath}
          selectedPathDataAttribute={{'data-subtitle-file-merge-input': target}}
          placeholder={`选择或粘贴${label}的 .srt 路径`} dropTitle={`拖入${label}`}
          chooseLabel={`选择${label}`} disabled={busy} compact applyOnChange
          onChoose={() => choose(target)} onUsePath={update} onDropPaths={paths => { if (paths[0]) update(paths[0]); }} />;
      })}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <ToolbarButton darkMode={darkMode} className="subtitle-accent-action" onClick={() => void merge()}
        disabled={busy || !selectedPartial.trim() || !basePath.trim()}>
        <Combine className="size-4" />{pending ? '正在合并…' : '合并并另存'}
      </ToolbarButton>
      {generatedSubtitlePath && selectedPartial !== generatedSubtitlePath && <ToolbarButton darkMode={darkMode}
        disabled={busy} onClick={() => setPartialPath(generatedSubtitlePath)}>使用刚生成的字幕作为 A</ToolbarButton>}
    </div>
    {result && <div className="grid min-w-0 gap-2 rounded-lg bg-[var(--result-surface)] p-3" role="status">
      <p className="text-sm">已合并：{formatSubtitleRangeTime(result.startMs)} – {formatSubtitleRangeTime(result.endMs)}</p>
      <p className="break-all text-xs text-muted-foreground">{result.outputPath}</p>
      <ToolbarButton darkMode={darkMode} onClick={() => void reveal()} className="justify-self-start">打开所在文件夹</ToolbarButton>
    </div>}
    {error && <StatusMessage tone="error">{error}</StatusMessage>}
  </div>;
}
