import type { RPCSchema } from "electrobun/bun";
import type { SubtitleMuxProgress } from "./subtitles/subtitleMux";
import type {
  TranslateSubtitleFileInput,
  TranslateSubtitleFileResult,
  SubtitleTranslationProgress,
} from "./subtitles/subtitleTranslation";
import type {
  WhisperMultiRangeTranscriptionResult,
  WhisperTimeRange,
  WhisperTranscriptionProgress,
} from "./transcription/whisperTranscription";
import type { FasterWhisperStatus } from "./transcription/fasterWhisperStatus";

export type SubtitleTranslationProgressEvent = SubtitleTranslationProgress & {
  subtitlePath: string;
};

export type WhisperTranscriptionProgressEvent = WhisperTranscriptionProgress & {
  videoPath: string;
};

type CliStatus = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};

export type DesktopRPC = {
  bun: RPCSchema<{
    requests: {
      configGet: { params: { key: string }; response: string | null };
      configSet: { params: { key: string; value: string }; response: string };
      openFilePath: { params: { filePath: string }; response: void };
      revealFilePath: { params: { filePath: string }; response: void };
      minimizeWindow: { params: void; response: void };
      closeWindow: { params: void; response: void };
      selectSubtitleMuxVideoFile: { params: void; response: string | null };
      selectSubtitleMuxSubtitleFile: { params: void; response: string | null };
      selectSubtitleTranslationFile: { params: void; response: string | null };
      selectFfmpegBinaryFile: { params: void; response: string | null };
      selectFasterWhisperPythonFile: { params: void; response: string | null };
      selectFasterWhisperModelDirectory: { params: void; response: string | null };
      consumeLocalFileDrop: { params: void; response: { paths: string[] } };
      getWhisperVideoDuration: { params: { videoPath: string }; response: { durationMs: number } };
      getLocalVideoPreviewUrl: { params: { videoPath: string }; response: { url: string } };
      getCompatibleVideoPreviewUrl: { params: { videoPath: string }; response: { url: string; reused: boolean } };
      getRuntimeEnvironment: { params: void; response: { platform: NodeJS.Platform; arch: string; isAppleSilicon: boolean } };
      mergeVideoWithSubtitle: { params: { videoPath: string; subtitlePath: string; outputPath: string }; response: { outputPath: string } };
      transcribeVideoSubtitle: { params: { videoPath: string; ranges: WhisperTimeRange[]; durationMs: number; language: string }; response: WhisperMultiRangeTranscriptionResult };
      cancelTranscribeVideoSubtitle: { params: { videoPath: string }; response: void };
      translateSubtitleFile: { params: TranslateSubtitleFileInput; response: TranslateSubtitleFileResult };
      testSubtitleTranslationConnection: { params: { proxyUrl?: string | null }; response: { available: boolean; error: string | null } };
      getFfmpegStatus: { params: void; response: CliStatus };
      getFasterWhisperStatus: { params: void; response: FasterWhisperStatus };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      subtitleMuxProgress: SubtitleMuxProgress;
      subtitleTranslationProgress: SubtitleTranslationProgressEvent;
      whisperTranscriptionProgress: WhisperTranscriptionProgressEvent;
    };
  }>;
};
