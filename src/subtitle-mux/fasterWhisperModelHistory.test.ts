import { describe, expect, test } from "bun:test";
import {
  addSuccessfulFasterWhisperModel,
  parseFasterWhisperModelHistory,
} from "./fasterWhisperModelHistory";

describe("Faster Whisper model history", () => {
  test("records a successful model once and makes it the most recent choice", () => {
    expect(
      addSuccessfulFasterWhisperModel(
        ["/Models/small", "/Models/large-v3"],
        " /Models/small ",
      ),
    ).toEqual(["/Models/small", "/Models/large-v3"]);
  });

  test("loads only valid, unique model paths from persisted data", () => {
    expect(
      parseFasterWhisperModelHistory(
        '[" /Models/small ", "", "/Models/small", 42, "/Models/large-v3"]',
      ),
    ).toEqual(["/Models/small", "/Models/large-v3"]);
  });
});
