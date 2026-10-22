import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runManagedProcess } from "./managedProcess";
import { resolveCliExecutable } from "../cliExecutable";

export type ReadinessItem = { ready: boolean; version: string | null; error: string | null };
export type WhisperReadiness = { python: ReadinessItem; whisper: ReadinessItem; model: ReadinessItem };
const missing = (error: string): ReadinessItem => ({ready:false,version:null,error});

// Python 与识别依赖独立探测，缺模型不短路前两项；手动配置和托管环境使用相同判据。
export async function probeWhisperReadiness(config: {pythonPath: string; modelPath: string}): Promise<WhisperReadiness> {
  const result: WhisperReadiness = {python:missing("Python 待安装"),whisper:missing("faster-whisper 待安装"),model:missing("模型待下载或选择")};
  const modelCheck = async () => {
    if (!config.modelPath) return;
    try {
      for (const file of ["model.bin","config.json","tokenizer.json"]) {
        const info = await stat(join(config.modelPath,file));
        if (!info.isFile() || info.size === 0) throw new Error(`模型缺少有效的 ${file}`);
      }
      JSON.parse(await readFile(join(config.modelPath,"config.json"),"utf8"));
      result.model={ready:true,version:null,error:null};
    } catch { result.model=missing("所选模型文件不完整，请下载或重新选择"); }
  };
  await Promise.all([modelCheck(), (async () => {
    try {
      const output=await runManagedProcess([resolveCliExecutable(config.pythonPath || "python3"),"-c", `import json,sys
r={"python":sys.version.split()[0],"whisper":None,"error":None}
try:
 import faster_whisper,ctranslate2,av,onnxruntime
 r["whisper"]=faster_whisper.__version__
except Exception as e:
 r["error"]=str(e)
print(json.dumps(r))`],{signal:AbortSignal.timeout(15000)});
      const data=JSON.parse(output.trim().split("\n").at(-1)!);
      result.python={ready:true,version:data.python,error:null};
      result.whisper=data.whisper ? {ready:true,version:data.whisper,error:null} : missing(data.error || "faster-whisper 待安装");
    } catch { result.python=missing("所选 Python 无法运行，请安装或重新选择"); }
  })()]);
  return result;
}

// 只有明确的一键准备才启用下载的模型；单独下载仍保持当前配置不变。
export async function prepareWhisper(steps: { install:()=>Promise<void>; download:()=>Promise<void>; validate:()=>Promise<void>; activate:()=>Promise<void> }, signal:AbortSignal) {
  for (const step of [steps.install,steps.download,steps.validate,steps.activate]) {
    signal.throwIfAborted(); await step();
  }
}
