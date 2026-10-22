// 文件清单按仓库实际内容区分，较小模型没有额外的预处理与词表文件。
const standardFiles = ["model.bin", "config.json", "tokenizer.json"];
const extendedFiles = [...standardFiles, "preprocessor_config.json", "vocabulary.json"];

// 仅列出保留原文的通用 CT2 模型，不混入日中翻译专用模型；下载选择不修改本地模型配置。
export const fasterWhisperModels = [
  { id: "tiny", label: "tiny", files: standardFiles, repo: "Systran/faster-whisper-tiny" },
  { id: "base", label: "base", files: standardFiles, repo: "Systran/faster-whisper-base" },
  { id: "small", label: "small", files: standardFiles, repo: "Systran/faster-whisper-small" },
  { id: "medium", label: "medium", files: standardFiles, repo: "Systran/faster-whisper-medium" },
  { id: "large-v2", label: "large-v2", files: standardFiles, repo: "Systran/faster-whisper-large-v2" },
  { id: "large-v3", label: "large-v3", files: extendedFiles, repo: "Systran/faster-whisper-large-v3" },

];

// 仓库名同时作为本地目录名，确保不同模型下载到独立目录。
export const getFasterWhisperDownloadCommand = (repo: string) =>
  `hf download ${repo} --local-dir ~/Models/${repo.split("/").at(-1)}`;
