import type { WhisperTranscriptionProgress } from "./whisperTranscription";

const FASTER_WHISPER_PROGRESS_PREFIX = "SUBTITLE_DUCK_FASTER_WHISPER_PROGRESS=";

// Keep the Python dependency outside the app bundle while retaining one stable CLI contract.
const FASTER_WHISPER_PYTHON_BRIDGE = String.raw`
import argparse
import math
import wave
from pathlib import Path

from faster_whisper import WhisperModel

parser = argparse.ArgumentParser()
parser.add_argument("--model", required=True)
parser.add_argument("--audio", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--language", default="ja")
args = parser.parse_args()

def srt_timestamp(seconds):
    milliseconds = max(0, round(seconds * 1000))
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

try:
    with wave.open(args.audio, "rb") as audio:
        duration_seconds = audio.getnframes() / audio.getframerate()
except Exception:
    duration_seconds = 0

print("SUBTITLE_DUCK_FASTER_WHISPER_PROGRESS=0", flush=True)
model = WhisperModel(
    args.model,
    device="cpu",
    compute_type="int8",
)
segments, _ = model.transcribe(
    args.audio,
    language=None if args.language == "auto" else args.language,
    task="translate",
    beam_size=5,
    vad_filter=True,
    condition_on_previous_text=False,
)

Path(args.output).parent.mkdir(parents=True, exist_ok=True)
with open(args.output, "w", encoding="utf-8") as output:
    for index, segment in enumerate(segments, start=1):
        output.write(f"{index}\n{srt_timestamp(segment.start)} --> {srt_timestamp(segment.end)}\n{segment.text.strip()}\n\n")
        if duration_seconds > 0:
            percent = min(99, round(segment.end / duration_seconds * 100))
            print(f"SUBTITLE_DUCK_FASTER_WHISPER_PROGRESS={percent}", flush=True)

print("SUBTITLE_DUCK_FASTER_WHISPER_PROGRESS=100", flush=True)
`;

export type FasterWhisperCommandInput = {
  pythonPath: string;
  modelPath: string;
  audioPath: string;
  outputPath: string;
  language: string;
};

export const buildFasterWhisperCommand = ({
  pythonPath,
  modelPath,
  audioPath,
  outputPath,
  language,
}: FasterWhisperCommandInput): string[] => [
  pythonPath,
  "-c",
  FASTER_WHISPER_PYTHON_BRIDGE,
  "--model",
  modelPath,
  "--audio",
  audioPath,
  "--output",
  outputPath,
  "--language",
  language,
];

export const parseFasterWhisperProgressText = (
  text: string
): WhisperTranscriptionProgress | null => {
  const matched = text.match(
    new RegExp(`${FASTER_WHISPER_PROGRESS_PREFIX}(\\d{1,3})`)
  );
  if (!matched?.[1]) return null;
  const percent = Math.max(0, Math.min(100, Number.parseInt(matched[1], 10)));
  return {
    phase: "transcribing",
    percent,
    message: `正在识别 ${percent}%`,
  };
};
