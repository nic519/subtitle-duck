import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAvailableWhisperOutputPathForRanges, transcribeVideoSubtitleRanges } from "./whisperTranscription";

const original = '1\n00:00:00,000 --> 00:00:20,000\n原文第一行\n<i>第二行</i>\n\n2\n00:00:30,000 --> 00:00:40,000\n后面的字幕\n';

describe('局部字幕替换', () => {
  test('局部识别复用同名字幕，全文识别仍另存', () => {
    const exists = (path: string) => path === '/video.srt';
    expect(getAvailableWhisperOutputPathForRanges('/video.mp4', exists, [{startMs:5000,endMs:10000}], 40000)).toBe('/video.srt');
    expect(getAvailableWhisperOutputPathForRanges('/video.mp4', exists, [{startMs:0,endMs:40000}], 40000)).toBe('/video-2.srt');
  });

  for (const mode of ['success', 'empty', 'failed', 'cancel', 'partial-cancel', 'invalid', 'edited', 'write-failed'] as const) {
    test(`真实文件保留选区外内容：${mode}`, async () => {
      const dir = await mkdtemp(join(tmpdir(), 'subtitle-replace-'));
      const outputPath = join(dir, 'video.srt');
      const controller = new AbortController();
      const source = mode === 'invalid' ? '无法解析的字幕' : original;
      await writeFile(outputPath, source);
      try {
        const run = transcribeVideoSubtitleRanges({videoPath:join(dir,'video.mp4'), outputPath, modelPath:'/model', language:'auto', replaceExistingSubtitle:true, ranges:[{startMs:5000,endMs:10000},{startMs:30000,endMs:40000}]}, {
          abortSignal:controller.signal,
          ...(mode === 'write-failed' ? {writeFile:async () => { throw new Error('磁盘写入失败'); }} : {}),
          transcribeRange:async (input) => {
            if (mode === 'partial-cancel' && input.startMs === 30000) { controller.abort(); throw new Error('字幕生成已停止'); }
            if (mode === 'failed' || input.startMs === 30000) throw new Error('识别失败');
            if (mode === 'cancel') { controller.abort(); throw new Error('字幕生成已停止'); }
            if (mode === 'edited') await writeFile(outputPath, original + '\n');
            await writeFile(input.outputPath, mode === 'empty' ? '' : '1\n00:00:05,000 --> 00:00:12,000\n新字幕\n');
            return {outputPath:input.outputPath};
          },
        });
        if (mode === 'invalid' || mode === 'edited' || mode === 'write-failed') {
          await expect(run).rejects.toThrow();
          expect(await readFile(outputPath,'utf8')).toBe(mode === 'edited' ? original+'\n' : source);
        } else {
          await run;
          const saved = await readFile(outputPath,'utf8');
          if (mode === 'failed' || mode === 'cancel') expect(saved).toBe(original);
          else {
            expect(saved).toContain('00:00:00,000 --> 00:00:05,000\n原文第一行\n<i>第二行</i>');
            expect(saved).toContain('00:00:10,000 --> 00:00:20,000\n原文第一行\n<i>第二行</i>');
            expect(saved).toContain('00:00:30,000 --> 00:00:40,000\n后面的字幕');
            expect(saved.includes('新字幕')).toBe(mode !== 'empty');
            if (mode === 'success') expect(saved).toContain('00:00:05,000 --> 00:00:10,000\n新字幕');
          }
        }
      } finally { await rm(dir,{recursive:true,force:true}); }
    });
  }
});

// 直接验证多个不连续选区与恰好相接的边界，不依赖识别模型。
import { replaceSrtRanges } from './replaceSrtRanges';
test('多选区保留间隙和边界字幕，并保留 CRLF 与 BOM', () => {
  const source = '\uFEFF1\r\n00:00:00,000 --> 00:00:20,000 X1:10\r\n原文\r\n\r\n2\r\n00:00:20,000 --> 00:00:21,000\r\n边界\r\n';
  const saved = replaceSrtRanges(source, [
    {range:{startMs:5000,endMs:10000},content:''},
    {range:{startMs:15000,endMs:20000},content:'1\n00:00:15,000 --> 00:00:20,000\n新文\n'},
  ]);
  expect(saved).toBe('\uFEFF1\r\n00:00:00,000 --> 00:00:05,000 X1:10\r\n原文\r\n\r\n2\r\n00:00:10,000 --> 00:00:15,000 X1:10\r\n原文\r\n\r\n3\r\n00:00:15,000 --> 00:00:20,000\r\n新文\r\n\r\n4\r\n00:00:20,000 --> 00:00:21,000\r\n边界\r\n');
});
