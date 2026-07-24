import { describe, expect, test } from "bun:test";
import { createLocalFileDropBroker } from "./localFileDropBroker";

describe("local file drop broker", () => {
  test("lets a newly published native drop replace a queued candidate during the grace period", async () => {
    const broker = createLocalFileDropBroker();
    broker.publish(["/native/queued.mp4"]);
    const consuming = broker.consume();
    broker.publish(["/native/current.mp4"]);

    expect(await consuming).toEqual(["/native/current.mp4"]);
  });

  test("expires an old queued drop without waiting for the production timeout", async () => {
    let now = 0;
    const broker = createLocalFileDropBroker({
      now: () => now,
      waitTimeoutMs: 0,
      queuedDropMaxAgeMs: 2_000,
      replacementDelayMs: 0,
    });
    broker.publish(["/native/old.mp4"]);
    now = 2_001;

    expect(await Promise.race([
      broker.consume(),
      new Promise<string[]>((resolve) =>
        setTimeout(() => resolve(["timeout"]), 50),
      ),
    ])).toEqual([]);
  });

  test("keeps concurrent consumers paired with consecutive native drops", async () => {
    const broker = createLocalFileDropBroker({ waitTimeoutMs: 20 });
    const first = broker.consume();
    const second = broker.consume();

    broker.publish(["/native/first.mp4"]);
    broker.publish(["/native/second.mp4"]);

    expect(await Promise.all([first, second])).toEqual([
      ["/native/first.mp4"],
      ["/native/second.mp4"],
    ]);
  });
});
