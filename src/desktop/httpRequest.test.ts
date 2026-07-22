import { describe, expect, test } from "bun:test";
import { buildRawRequestInit } from "./httpRequest";

describe("buildRawRequestInit", () => {
  test("uses an explicitly configured proxy", () => {
    expect(
      buildRawRequestInit(
        { method: "GET", timeoutMs: 1_000 },
        { enabled: true, url: "http://127.0.0.1:7890" },
      ).proxy,
    ).toBe("http://127.0.0.1:7890");
  });

  test("does not set a proxy when the setting is empty or disabled", () => {
    expect(buildRawRequestInit({ method: "GET" }).proxy).toBeUndefined();
    expect(
      buildRawRequestInit(
        { method: "GET" },
        { enabled: false, url: "http://127.0.0.1:7890" },
      ).proxy,
    ).toBeUndefined();
  });
});
