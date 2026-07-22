const MAX_FASTER_WHISPER_MODEL_HISTORY = 8;

export const parseFasterWhisperModelHistory = (
  value: string | null,
): string[] => {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.reduce<string[]>((paths, path) => {
      if (typeof path !== "string") return paths;
      const normalizedPath = path.trim();
      if (!normalizedPath || paths.includes(normalizedPath)) return paths;
      return [...paths, normalizedPath];
    }, []);
  } catch {
    return [];
  }
};

export const addSuccessfulFasterWhisperModel = (
  history: string[],
  modelPath: string | null,
): string[] => {
  const normalizedPath = modelPath?.trim();
  if (!normalizedPath) return history;

  return [
    normalizedPath,
    ...history.filter((path) => path !== normalizedPath),
  ].slice(0, MAX_FASTER_WHISPER_MODEL_HISTORY);
};
