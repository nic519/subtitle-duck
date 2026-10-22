import { readFile, writeFile } from 'node:fs/promises';
import { extname, parse, join, resolve } from 'node:path';
import { getSrtCoverageRange, replaceSrtRanges } from '../transcription/replaceSrtRanges';

export type MergeSubtitleFilesInput = { partialPath: string; basePath: string };
export type MergeSubtitleFilesResult = { outputPath: string; startMs: number; endMs: number };

// 独立于识别模型工作，A/B 均使用原视频时间；完整校验后才创建新文件，绝不回写输入。
export async function mergeSubtitleFiles(input: MergeSubtitleFilesInput): Promise<MergeSubtitleFilesResult> {
  const partialPath = input.partialPath.trim(), basePath = input.basePath.trim();
  if ([partialPath, basePath].some(path => extname(path).toLowerCase() !== '.srt')) {
    throw new Error('请选择局部字幕 A 和完整字幕 B，均须为 SRT 文件');
  }
  if (resolve(partialPath) === resolve(basePath)) throw new Error('A 和 B 不能是同一份字幕');
  const [partial, base] = await Promise.all([readFile(partialPath, 'utf8'), readFile(basePath, 'utf8')]);
  const range = getSrtCoverageRange(partial);
  getSrtCoverageRange(base);
  const content = replaceSrtRanges(base, [{range, content: partial}]);
  const { dir, name } = parse(basePath);
  // 独占创建同时处理同名文件和并发合并；已有结果保留，通过序号避让。
  for (let index = 1; ; index++) {
    const outputPath = join(dir, `${name}-合并${index === 1 ? '' : `-${index}`}.srt`);
    try {
      await writeFile(outputPath, content, {flag: 'wx'});
      return {outputPath, ...range};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}
