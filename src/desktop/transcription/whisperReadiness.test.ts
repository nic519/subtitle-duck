import {test,expect} from 'bun:test';
import {prepareWhisper,probeWhisperReadiness} from './whisperReadiness';

test('缺模型不掩盖 Python 已就绪',async()=>{
 const status=await probeWhisperReadiness({pythonPath:'python3',modelPath:''});
 expect(status.python.ready).toBe(true);
 expect(status.model.ready).toBe(false);
 expect(status.model.error).toContain('模型');
});
test('一键准备在安装、下载、校验后才启用；失败不改当前模型',async()=>{
 const order:string[]=[];
 const steps={install:async()=>{order.push('install')},download:async()=>{order.push('download')},validate:async()=>{order.push('validate')},activate:async()=>{order.push('activate')}};
 await prepareWhisper(steps,new AbortController().signal);
 expect(order).toEqual(['install','download','validate','activate']);
 order.length=0;
 await expect(prepareWhisper({...steps,validate:async()=>{throw new Error('bad model')}},new AbortController().signal)).rejects.toThrow('bad model');
 expect(order).toEqual(['install','download']);
});
