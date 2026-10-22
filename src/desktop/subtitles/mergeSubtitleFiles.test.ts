import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeSubtitleFiles } from './mergeSubtitleFiles';

const full = '\uFEFF1\r\n00:00:00,000 --> 00:00:20,000 X1:10\r\n原文\r\n\r\n2\r\n00:00:30,000 --> 00:00:40,000\r\n后文\r\n';
// 故意逆序，验证覆盖范围按时间计算，同时保留 A 中的空隙和多行文字。
const partial = '1\n00:00:12,000 --> 00:00:15,000\n新文二\n\n2\n00:00:05,000 --> 00:00:08,000\n新文一\n第二行\n';

describe('独立字幕合并', () => {
  test('A 覆盖完整时间范围，裁剪 B 跨界字幕，另存且不覆盖已有结果', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'merge-srt-'));
    try {
      const partialPath = join(dir, 'A.srt'), basePath = join(dir, 'B.srt');
      await writeFile(partialPath, partial);
      await writeFile(basePath, full);
      const results = await Promise.all([mergeSubtitleFiles({partialPath, basePath}), mergeSubtitleFiles({partialPath, basePath})]);
      expect(results[0].outputPath).not.toBe(results[1].outputPath);
      for (const result of results) {
        expect(result.startMs).toBe(5000);
        expect(result.endMs).toBe(15000);
        expect(await readFile(result.outputPath, 'utf8')).toBe('\uFEFF1\r\n00:00:00,000 --> 00:00:05,000 X1:10\r\n原文\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\n新文一\r\n第二行\r\n\r\n3\r\n00:00:12,000 --> 00:00:15,000\r\n新文二\r\n\r\n4\r\n00:00:15,000 --> 00:00:20,000 X1:10\r\n原文\r\n\r\n5\r\n00:00:30,000 --> 00:00:40,000\r\n后文\r\n');
      }
      expect(await readFile(partialPath, 'utf8')).toBe(partial);
      expect(await readFile(basePath, 'utf8')).toBe(full);
    } finally { await rm(dir, {recursive:true, force:true}); }
  });

  for (const [a, b] of [['', full], ['无效', full], [partial, '无效'], [partial, '']]) {
    test(`拒绝空或无效输入且不产生结果：${a.slice(0,2)} / ${b.slice(0,2)}`, async () => {
      const dir = await mkdtemp(join(tmpdir(), 'merge-srt-'));
      try {
        const partialPath = join(dir, 'A.srt'), basePath = join(dir, 'B.srt');
        await writeFile(partialPath, a); await writeFile(basePath, b);
        await expect(mergeSubtitleFiles({partialPath, basePath})).rejects.toThrow();
        expect((await readdir(dir)).sort()).toEqual(['A.srt', 'B.srt']);
      } finally { await rm(dir, {recursive:true, force:true}); }
    });
  }
});
