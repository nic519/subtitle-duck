export type SubtitleGenerationRange = {
  startMs: number;
  endMs: number;
};

const clampMs = (milliseconds: number): number =>
  Math.max(0, Math.round(milliseconds));

export const formatSubtitleRangeTime = (
  milliseconds: number,
  separator: "." | "," = "."
): string => {
  const totalMs = clampMs(milliseconds);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const ms = totalMs % 1_000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(ms).padStart(3, "0")}`;
};

export const createDefaultSubtitleGenerationRange = (
  durationMs: number
): SubtitleGenerationRange => ({
  startMs: 0,
  endMs: clampMs(durationMs),
});

export const isSubtitleGenerationRangeValid = ({
  startMs,
  endMs,
  durationMs,
}: SubtitleGenerationRange & { durationMs: number | null }): boolean => {
  if (durationMs !== null && endMs > durationMs) return false;
  return startMs >= 0 && startMs < endMs;
};
