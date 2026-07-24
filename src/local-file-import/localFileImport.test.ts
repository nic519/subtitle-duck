import { describe, expect, test } from "bun:test";
import { createLocalFileImport } from "./localFileImport";

const drop = ({
  filePaths = [],
  data = {},
}: {
  filePaths?: string[];
  data?: Record<string, string>;
}) => ({
  files: filePaths.map((path) => ({ path })),
  getData: (format: string) => data[format] ?? "",
});

describe("local file import", () => {
  test("prefers the macOS native adapter and falls back to normalized DataTransfer paths", async () => {
    const nativePaths: string[][] = [["/native/movie.mp4"], []];
    const fileImport = createLocalFileImport({
      consumeNativeDrop: async () => nativePaths.shift() ?? [],
    });
    const dataTransfer = drop({ filePaths: ["/browser/movie.mp4"] });

    expect(await fileImport.resolve(dataTransfer)).toEqual(["/native/movie.mp4"]);
    expect(await fileImport.resolve(dataTransfer)).toEqual(["/browser/movie.mp4"]);
  });

  test("does not wait for the native adapter when DataTransfer has no files", async () => {
    let nativeCalls = 0;
    const fileImport = createLocalFileImport({
      consumeNativeDrop: async () => {
        nativeCalls += 1;
        return ["/native/ignored.mp4"];
      },
    });

    expect(
      await fileImport.resolve(drop({
        data: {
          "text/uri-list": "file:///Volumes/Movies/demo.mp4\r\nfile:///Volumes/Movies/demo.srt",
        },
      })),
    ).toEqual([
      "/Volumes/Movies/demo.mp4",
      "/Volumes/Movies/demo.srt",
    ]);
    expect(nativeCalls).toBe(0);
  });

  test("uses plain text and WebKit file-url formats as ordered fallbacks", async () => {
    const fileImport = createLocalFileImport({
      consumeNativeDrop: async () => [],
    });

    expect(await fileImport.resolve(drop({
      data: { "text/plain": "/Volumes/Movies/plain.mp4" },
    }))).toEqual(["/Volumes/Movies/plain.mp4"]);
    expect(await fileImport.resolve(drop({
      data: { "public.file-url": "file:///Volumes/Movies/webkit.mp4" },
    }))).toEqual(["/Volumes/Movies/webkit.mp4"]);
  });
});
