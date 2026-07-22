export type RawHttpMethod = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";

export type RawHttpRequest = {
  url: string;
  method: RawHttpMethod;
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type MyJavProxyConfig = {
  enabled?: boolean;
  url?: string;
};

export const buildRawRequestInit = (
  request: Omit<RawHttpRequest, "url">,
  proxyConfig?: MyJavProxyConfig,
) => {
  const proxyUrl = proxyConfig?.enabled ? proxyConfig.url?.trim() : "";
  return {
    method: request.method,
    body: request.body,
    headers: request.headers,
    signal: AbortSignal.timeout(request.timeoutMs ?? 20_000),
    ...(proxyUrl ? { proxy: proxyUrl } : {}),
  };
};

export const requestRaw = async (
  request: RawHttpRequest,
  proxyConfig?: MyJavProxyConfig,
): Promise<string> => {
  const response = await fetch(request.url, buildRawRequestInit(request, proxyConfig));
  if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);
  return response.text();
};
