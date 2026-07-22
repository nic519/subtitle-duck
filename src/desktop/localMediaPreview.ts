import { existsSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

type MediaPreviewEntry = {
  path: string;
  fileName: string;
};

type BunServer = ReturnType<typeof Bun.serve>;

const contentTypesByExtension: Record<string, string> = {
  ".avi": "video/x-msvideo",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".ts": "video/mp2t",
  ".wmv": "video/x-ms-wmv",
  ".webm": "video/webm",
};

const createRangeResponse = (
  filePath: string,
  fileSize: number,
  contentType: string,
  rangeHeader: string
): Response => {
  const matched = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!matched) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  const requestedStart = matched[1] ? Number.parseInt(matched[1], 10) : 0;
  const requestedEnd = matched[2]
    ? Number.parseInt(matched[2], 10)
    : fileSize - 1;
  const start = Math.max(0, requestedStart);
  const end = Math.min(fileSize - 1, requestedEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  return new Response(Bun.file(filePath).slice(start, end + 1), {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Type": contentType,
      },
    });
};

export const createLocalMediaPreviewServer = () => {
  const entries = new Map<string, MediaPreviewEntry>();
  let server: BunServer | null = null;

  const ensureServer = () => {
    if (server) return server;

    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        const matched = url.pathname.match(/^\/media\/([^/]+)\//);
        const id = matched ? decodeURIComponent(matched[1]) : "";
        const entry = entries.get(id);

        if (!entry || !existsSync(entry.path)) {
          return new Response("Not found", { status: 404 });
        }

        const stats = statSync(entry.path);
        if (!stats.isFile()) {
          return new Response("Not found", { status: 404 });
        }

        const contentType =
          contentTypesByExtension[extname(entry.path).toLowerCase()] ||
          "application/octet-stream";
        const rangeHeader = request.headers.get("range");

        if (rangeHeader) {
          return createRangeResponse(
            entry.path,
            stats.size,
            contentType,
            rangeHeader
          );
        }

        return new Response(Bun.file(entry.path), {
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Length": String(stats.size),
            "Content-Type": contentType,
          },
        });
      },
    });

    return server;
  };

  return {
    getPreviewUrl(filePath: string): string {
      const trimmedPath = filePath.trim();
      if (!trimmedPath) throw new Error("视频路径为空");
      if (!existsSync(trimmedPath)) {
        throw new Error(`视频文件不存在: ${trimmedPath}`);
      }

      const id = crypto.randomUUID();
      const fileName = basename(trimmedPath);
      entries.set(id, { path: trimmedPath, fileName });
      const activeServer = ensureServer();
      const encodedFileName = encodeURIComponent(fileName);
      return `http://127.0.0.1:${activeServer.port}/media/${id}/${encodedFileName}`;
    },
    stop() {
      server?.stop(true);
      server = null;
      entries.clear();
    },
  };
};
