import { formatSubtitleRangeTime } from '../../subtitle-mux/subtitleGenerationRange';
import type { WhisperTimeRange } from './whisperTranscription';

type Cue = WhisperTimeRange & { text: string; settings: string };

// 严格解析后再允许覆盖，防止不支持的字幕格式被静默丢弃；保留多行文本和位置设置。
const parseCues = (content: string): Cue[] => {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  return normalized.split(/\n[ \t]*\n/).map(block => {
    const match = block.match(/^\d+\n(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})[ \t]+-->[ \t]+(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})([^\n]*)\n([\s\S]+)$/);
    if (!match) throw new Error('已有字幕不是有效的 SRT，无法局部替换，请检查字幕文件');
    const time = (offset: number) => Number(match[offset])*3600000 + Number(match[offset+1])*60000 + Number(match[offset+2])*1000 + Number(match[offset+3]);
    const startMs = time(1), endMs = time(5);
    if (endMs <= startMs) throw new Error('字幕时间范围无效，无法局部替换');
    return {startMs, endMs, settings:match[9], text:match[10]};
  });
};

// 独立合并没有识别选区元数据，以 A 的首尾时间定义连续覆盖范围；空文件不能用于清空 B。
export const getSrtCoverageRange = (content: string): WhisperTimeRange => {
  const cues = parseCues(content);
  if (!cues.length) throw new Error('字幕为空，请选择包含字幕条目的 SRT 文件');
  return cues.reduce((range, cue) => ({
    startMs: Math.min(range.startMs, cue.startMs),
    endMs: Math.max(range.endMs, cue.endMs),
  }), { startMs: Infinity, endMs: 0 });
};

// 用半开区间裁剪旧字幕，跨界条目仅移除选区内部分；失败范围不传入此函数。
export const replaceSrtRanges = (existing: string, replacements: Array<{range: WhisperTimeRange; content: string}>): string => {
  let retained = parseCues(existing);
  const added: Cue[] = [];
  for (const {range, content} of replacements) {
    retained = retained.flatMap(cue => {
      if (cue.endMs <= range.startMs || cue.startMs >= range.endMs) return [cue];
      const pieces: Cue[] = [];
      if (cue.startMs < range.startMs) pieces.push({...cue, endMs:range.startMs});
      if (cue.endMs > range.endMs) pieces.push({...cue, startMs:range.endMs});
      return pieces;
    });
    // 推理输出可能越过选区终点，写入前限制到用户选定的范围。
    added.push(...parseCues(content).map(cue => ({...cue, startMs:Math.max(cue.startMs,range.startMs), endMs:Math.min(cue.endMs,range.endMs)})).filter(cue => cue.startMs < cue.endMs));
  }
  const cues = [...retained, ...added].sort((a,b) => a.startMs-b.startMs || a.endMs-b.endMs);
  const newline = existing.includes('\r\n') ? '\r\n' : '\n';
  const body = cues.map((cue,index) => `${index+1}\n${formatSubtitleRangeTime(cue.startMs, ',')} --> ${formatSubtitleRangeTime(cue.endMs, ',')}${cue.settings}\n${cue.text}`).join('\n\n');
  return (existing.startsWith('\uFEFF') ? '\uFEFF' : '') + (body ? `${body}\n`.replace(/\n/g,newline) : '');
};
