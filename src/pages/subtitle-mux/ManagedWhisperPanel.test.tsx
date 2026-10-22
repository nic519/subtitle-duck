import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ManagedWhisperTaskProgress } from './ManagedWhisperPanel';

test('依赖安装没有百分比时仍显示处理中、时长和网络等待提示', () => {
  const html=renderToStaticMarkup(<ManagedWhisperTaskProgress task={{state:'running',message:'安装依赖',percent:null,log:'',startedAt:1000,lastActivityAt:1000,activity:'Downloading numpy'}} now={61000}/>);
  expect(html).toContain('已用 1 分 0 秒');
  expect(html).toContain('Downloading numpy');
  expect(html).toContain('没有新输出');
  expect(html).toContain('<progress');
  expect(html).not.toMatch(/<progress[^>]*value=/);
});

test('结束后停止等待动画，已知下载比例准确展示', () => {
  const task={state:'running' as const,message:'下载',percent:42,log:'',startedAt:1000,lastActivityAt:59000,activity:''};
  expect(renderToStaticMarkup(<ManagedWhisperTaskProgress task={task} now={60000}/>)).toContain('value="42"');
  expect(renderToStaticMarkup(<ManagedWhisperTaskProgress task={{...task,state:'error'}} now={60000}/>)).toBe('');
});
