import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFasterWhisperCommand } from "./fasterWhisperTranscription";

// 执行真实 Python 桥接，仅替换耗时的模型推理，验证模式、语言及 SRT 原文输出。
test("生成字幕自动检测语言并转写原文，不进入翻译模式", async () => {
  const dir = mkdtempSync(join(tmpdir(), "subtitle-original-"));
  try {
    writeFileSync(join(dir, "faster_whisper.py"), `
import json
from pathlib import Path
from types import SimpleNamespace
class WhisperModel:
    def __init__(self, *args, **kwargs): pass
    def transcribe(self, audio, **kwargs):
        Path(__file__).with_name('options.json').write_text(json.dumps(kwargs))
        text = 'こんにちは' if kwargs['task'] == 'transcribe' else 'Hello'
        return iter([SimpleNamespace(start=0, end=1, text=text)]), None
`);
    const outputPath = join(dir, "output.srt");
    const command = buildFasterWhisperCommand({ pythonPath: "python3", modelPath: "test-model", audioPath: join(dir, "audio.wav"), outputPath, language: "auto" });
    const proc = Bun.spawn(command, { env: { ...process.env, PYTHONPATH: dir }, stdout: "pipe", stderr: "pipe" });
    expect(await proc.exited).toBe(0);
    const options = JSON.parse(readFileSync(join(dir, "options.json"), "utf8"));
    expect(options.task).toBe("transcribe");
    expect(options.language).toBeNull();
    expect(readFileSync(outputPath, "utf8")).toBe("1\n00:00:00,000 --> 00:00:01,000\nこんにちは\n\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
