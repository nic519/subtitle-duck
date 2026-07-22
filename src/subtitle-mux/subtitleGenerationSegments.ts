import type { SubtitleGenerationRange } from "./subtitleGenerationRange";

export type SubtitleGenerationSegment = {
  id: string;
  startMs: number;
  endMs: number | null;
  initial?: true;
};

export type SubtitleGenerationSegmentsResult =
  | { ok: true; segments: SubtitleGenerationSegment[] }
  | { ok: false; error: string };

const clampMs = (value: number, durationMs: number): number =>
  Math.min(Math.max(0, Math.round(value)), Math.max(0, Math.round(durationMs)));

const sortSegments = (
  segments: SubtitleGenerationSegment[]
): SubtitleGenerationSegment[] =>
  [...segments].sort(
    (left, right) =>
      left.startMs - right.startMs || left.id.localeCompare(right.id)
  );

export const createInitialSubtitleGenerationSegments = (
  durationMs: number,
  id: string
): SubtitleGenerationSegment[] => [
  {
    id,
    startMs: 0,
    endMs: Math.max(0, Math.round(durationMs)),
    initial: true,
  },
];

export const getValidSubtitleGenerationRanges = (
  segments: SubtitleGenerationSegment[]
): SubtitleGenerationRange[] =>
  sortSegments(segments).flatMap(({ startMs, endMs }) =>
    endMs !== null && startMs < endMs ? [{ startMs, endMs }] : []
  );

export const validateSubtitleGenerationSegments = (
  segments: SubtitleGenerationSegment[],
  durationMs: number
): { ok: true } | { ok: false; error: string } => {
  const sorted = sortSegments(segments);
  for (const [index, segment] of sorted.entries()) {
    if (
      segment.startMs < 0 ||
      segment.startMs > durationMs ||
      (segment.endMs !== null && segment.endMs > durationMs)
    ) {
      return { ok: false, error: "字幕片段不能超过视频时长" };
    }
    if (segment.endMs !== null && segment.startMs >= segment.endMs) {
      return { ok: false, error: "开始时间必须早于结束时间" };
    }

    const previous = sorted[index - 1];
    if (!previous) continue;
    const previousEndMs = previous.endMs ?? previous.startMs;
    if (segment.startMs < previousEndMs) {
      return { ok: false, error: "字幕片段不能重叠" };
    }
    if (
      segment.endMs === null &&
      previous.endMs !== null &&
      segment.startMs >= previous.startMs &&
      segment.startMs < previous.endMs
    ) {
      return { ok: false, error: "字幕片段不能重叠" };
    }
  }
  return { ok: true };
};

export const addSubtitleGenerationMarker = (
  segments: SubtitleGenerationSegment[],
  {
    id,
    startMs,
    durationMs,
  }: { id: string; startMs: number; durationMs: number }
): SubtitleGenerationSegmentsResult => {
  const marker: SubtitleGenerationSegment = {
    id,
    startMs: clampMs(startMs, durationMs),
    endMs: null,
  };
  const baseSegments =
    segments.length === 1 && segments[0]?.initial ? [] : segments;
  const containingRange = baseSegments.find(
    (segment) =>
      segment.endMs !== null &&
      marker.startMs >= segment.startMs &&
      marker.startMs < segment.endMs
  );
  if (containingRange) return { ok: false, error: "字幕片段不能重叠" };

  const nextSegments = sortSegments([...baseSegments, marker]);
  const validation = validateSubtitleGenerationSegments(
    nextSegments,
    durationMs
  );
  return validation.ok ? { ok: true, segments: nextSegments } : validation;
};

export const updateSubtitleGenerationSegment = (
  segments: SubtitleGenerationSegment[],
  segmentId: string,
  update: Partial<Pick<SubtitleGenerationSegment, "startMs" | "endMs">>,
  durationMs: number
): SubtitleGenerationSegmentsResult => {
  if (!segments.some(({ id }) => id === segmentId)) {
    return { ok: false, error: "字幕片段不存在" };
  }
  const nextSegments = sortSegments(
    segments.map((segment) => {
      if (segment.id !== segmentId) return segment;
      const startMs =
        update.startMs === undefined
          ? segment.startMs
          : clampMs(update.startMs, durationMs);
      const endMs =
        update.endMs === undefined || update.endMs === null
          ? update.endMs === null
            ? null
            : segment.endMs
          : clampMs(update.endMs, durationMs);
      return { id: segment.id, startMs, endMs };
    })
  );
  const validation = validateSubtitleGenerationSegments(
    nextSegments,
    durationMs
  );
  return validation.ok ? { ok: true, segments: nextSegments } : validation;
};

export const removeSubtitleGenerationSegment = (
  segments: SubtitleGenerationSegment[],
  segmentId: string
): SubtitleGenerationSegment[] => segments.filter(({ id }) => id !== segmentId);
