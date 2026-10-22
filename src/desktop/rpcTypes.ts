import type { FfmpegInstallStatus } from "./ffmpeg/managedFfmpeg";
import type { ManagedWhisperRequest, ManagedWhisperSnapshot } from "./transcription/managedWhisper";
import type { MergeSubtitleFilesInput, MergeSubtitleFilesResult } from "./subtitles/mergeSubtitleFiles";
import type { VideoMetadata } from "./videoMetadata";
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
      isWindowMaximized: { params: void; response: boolean };
      configGet: { params: { key: string }; response: string | null };
      configSet: { params: { key: string; value: string }; response: string };
      openFilePath: { params: { filePath: string }; response: void };
      revealFilePath: { params: { filePath: string }; response: void };
      selectSubtitleMuxVideoFile: { params: void; response: string | null };
      selectSubtitleMuxSubtitleFile: { params: void; response: string | null };
      selectSubtitleTranslationFile: { params: void; response: string | null };
      mergeSubtitleFiles: { params: MergeSubtitleFilesInput; response: MergeSubtitleFilesResult };
      selectFfmpegBinaryFile: { params: void; response: string | null };
      selectFasterWhisperPythonFile: { params: void; response: string | null };
      selectFasterWhisperModelDirectory: { params: void; response: string | null };
      consumeLocalFileDrop: { params: void; response: { paths: string[] } };
      getVideoMetadata: { params: { videoPath: string }; response: VideoMetadata };
      getWhisperVideoDuration: { params: { videoPath: string }; response: { durationMs: number } };
      getLocalVideoPreviewUrl: { params: { videoPath: string }; response: { url: string } };
      getCompatibleVideoPreviewUrl: { params: { videoPath: string }; response: { url: string; reused: boolean } };
      mergeVideoWithSubtitle: { params: { videoPath: string; subtitlePath: string; outputPath: string }; response: { outputPath: string } };
      transcribeVideoSubtitle: { params: { videoPath: string; ranges: WhisperTimeRange[]; durationMs: number; language: string }; response: WhisperMultiRangeTranscriptionResult };
      cancelTranscribeVideoSubtitle: { params: { videoPath: string }; response: void };
      translateSubtitleFile: { params: TranslateSubtitleFileInput; response: TranslateSubtitleFileResult };
      cancelTranslateSubtitleFile: { params: { subtitlePath: string }; response: void };
      testSubtitleTranslationConnection: { params: { proxyUrl?: string | null }; response: { available: boolean; error: string | null } };
      getFfmpegInstallStatus: { params: void; response: FfmpegInstallStatus };
      installFfmpeg: { params: void; response: void };
      cancelFfmpegInstall: { params: void; response: void };
      getFfmpegStatus: { params: void; response: CliStatus };
      getManagedWhisper: { params: void; response: ManagedWhisperSnapshot };
      detectWhisperUv: { params: void; response: ManagedWhisperSnapshot };
      startManagedWhisper: { params: ManagedWhisperRequest; response: void };
      cancelManagedWhisper: { params: void; response: void };
      getFasterWhisperStatus: { params: void; response: FasterWhisperStatus };
    };
    messages: {
      minimizeWindow: void;
      toggleMaximizeWindow: void;
      closeWindow: void;
    };
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
