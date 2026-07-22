export const buildStreamingPreviewSeekUrl = (
  previewUrl: string,
  startMs: number,
): string => {
  const url = new URL(previewUrl);
  url.searchParams.set("startMs", String(Math.max(0, Math.round(startMs))));
  return url.toString();
};
