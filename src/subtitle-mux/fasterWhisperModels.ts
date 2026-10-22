// 文件清单按仓库实际内容区分，较小模型使用 vocabulary.txt，large-v3 使用 vocabulary.json 和预处理配置。
const coreFiles = ["model.bin", "config.json", "tokenizer.json"];
const standardFiles = [...coreFiles, "vocabulary.txt"];
const extendedFiles = [...coreFiles, "preprocessor_config.json", "vocabulary.json"];

// 通用转写模型与用户指定的海南鸡模型共用下载管理；选择下载项不修改当前配置。
export const fasterWhisperModels = [
  { id: "tiny", label: "tiny", files: standardFiles, repo: "Systran/faster-whisper-tiny" },
  { id: "medium", label: "medium", files: standardFiles, repo: "Systran/faster-whisper-medium" },
  { id: "large-v2", label: "large-v2", files: standardFiles, repo: "Systran/faster-whisper-large-v2" },
  { id: "large-v3", label: "large-v3", files: extendedFiles, repo: "Systran/faster-whisper-large-v3" },
  { id: "chickenrice-v2", label: "海南鸡（日语→中文）", files: extendedFiles, repo: "chickenrice0721/whisper-large-v2-translate-zh-v0.2-st-ct2" },
];
