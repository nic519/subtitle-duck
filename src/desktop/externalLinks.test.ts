import { expect, test } from "bun:test";
import { openExternalLink } from "./externalLinks";

test("opens native and serialized new-window links without losing download parameters", () => {
  const url = "https://huggingface.co/Systran/faster-whisper-large-v3/resolve/main/model.bin?download=true";
  const opened: string[] = [];
  for (const detail of [{ url }, JSON.stringify({ url }), url]) {
    expect(openExternalLink(detail, (value) => { opened.push(value); return true; })).toBe(true);
  }
  expect(opened).toEqual([url, url, url]);
});

test("ignores malformed events and non-web protocols", () => {
  for (const detail of [null, {}, { url: 3 }, "invalid", "file:///tmp/test", "javascript:alert(1)"]) {
    expect(openExternalLink(detail, () => { throw new Error("must not open"); })).toBe(false);
  }
});
