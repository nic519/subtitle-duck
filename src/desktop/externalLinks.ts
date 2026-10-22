// 兼容原生 WebView 与预加载脚本的事件格式，仅将网页链接交给系统浏览器。
export const openExternalLink = (
  detail: unknown,
  open: (url: string) => boolean,
): boolean => {
  let payload = detail;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { /* 旧版事件可能直接传 URL。 */ }
  }
  const url = typeof payload === "string"
    ? payload
    : payload && typeof payload === "object" && "url" in payload
      ? payload.url
      : null;
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  } catch { return false; }
  return open(url);
};
