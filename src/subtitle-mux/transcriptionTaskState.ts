import type {
  WhisperMultiRangeTranscriptionResult,
  WhisperTranscriptionProgress,
  WhisperTimeRange,
} from "../desktop/transcription/whisperTranscription";

export type WhisperTranscriptionTaskInput = {
  videoPath: string;
  ranges: WhisperTimeRange[];
  durationMs: number;
  language: string;
};

type WhisperTranscriptionTaskBase = {
  input: WhisperTranscriptionTaskInput;
  progress: WhisperTranscriptionProgress | null;
  commandLines: string[];
};

export type WhisperTranscriptionTaskState =
  | (WhisperTranscriptionTaskBase & { status: "running" })
  | (WhisperTranscriptionTaskBase & {
      status: "completed";
      result: WhisperMultiRangeTranscriptionResult;
    })
  | (WhisperTranscriptionTaskBase & { status: "failed"; error: string });

export const startWhisperTranscriptionTask = (
  input: WhisperTranscriptionTaskInput
): WhisperTranscriptionTaskState => ({
  status: "running",
  input,
  progress: null,
  commandLines: [],
});

export const updateWhisperTranscriptionTask = (
  state: WhisperTranscriptionTaskState,
  progress: WhisperTranscriptionProgress
): WhisperTranscriptionTaskState => ({
  ...state,
  progress,
  commandLines:
    progress.phase === "command" && !state.commandLines.includes(progress.command)
      ? [...state.commandLines, progress.command]
      : state.commandLines,
});

export const completeWhisperTranscriptionTask = (
  state: WhisperTranscriptionTaskState,
  result: WhisperMultiRangeTranscriptionResult
): WhisperTranscriptionTaskState => ({
  ...state,
  status: "completed",
  result,
});

export const failWhisperTranscriptionTask = (
  state: WhisperTranscriptionTaskState,
  error: string
): WhisperTranscriptionTaskState => ({
  ...state,
  status: "failed",
  error,
});
