import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAvailableWhisperOutputPathForRanges, transcribeVideoSubtitleRanges } from "./whisperTranscription";

const original = '1\n00:00:00,000 --> 00:00:20,000\n原文第一行\n<i>第二行</i>\n\n2\n00:00:30,000 --> 00:00:40,000\n后面的字幕\n';

describe('识别结果独立保存', () => {
  test('局部和全文识别均避开已有字幕', () => {
    const exists = (path: string) => path === '/video.srt';
    for (const ranges of [[{startMs:5000,endMs:10000}], [{startMs:0,endMs:40000}]]) {
      expect(getAvailableWhisperOutputPathForRanges('/video.mp4', exists, ranges, 40000)).toBe('/video-2.srt');
    }
  });

  for (const mode of ['success', 'failed', 'cancel'] as const) {
    test(`选区识别不读取或修改原字幕：${mode}`, async () => {
      const dir = await mkdtemp(join(tmpdir(), 'subtitle-separate-'));
      const originalPath = join(dir, 'video.srt');
      await writeFile(originalPath, original);
      try {
        const ranges = [{startMs:5000,endMs:10000}];
        const outputPath = getAvailableWhisperOutputPathForRanges(join(dir, 'video.mp4'), path => path === originalPath, ranges, 40000);
        const result = await transcribeVideoSubtitleRanges({videoPath:join(dir,'video.mp4'), outputPath, modelPath:'/model', language:'auto', ranges}, {
          transcribeRange:async input => {
            if (mode !== 'success') throw new Error(mode === 'cancel' ? '字幕生成已停止' : '识别失败');
            await writeFile(input.outputPath, '1\n00:00:05,000 --> 00:00:10,000\n新字幕\n');
            return {outputPath:input.outputPath};
          },
        });
        expect(await readFile(originalPath,'utf8')).toBe(original);
        if (mode === 'success') {
          expect(result.outputPath).toBe(outputPath);
          const saved = await readFile(outputPath, 'utf8');
          expect(saved).toContain('新字幕');
          expect(saved).toContain('00:00:05,000');
          expect(saved).not.toContain('原文');
        } else {
          expect(result.outputPath).toBeNull();
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
