import { expect, test } from "bun:test";
import { createSubtitleGenerationBatch } from "./subtitleGenerationBatch";

const result = (path: string) => ({ outputPath: `${path}.srt`, completedRanges: [{ startMs: 0, endMs: 1000 }], failedRanges: [], pendingRanges: [], interruptedRange: null, stopped: false });

test("批量去重、顺序处理完整视频，失败后继续且再次启动不重复成功项", async () => {
  const calls: string[] = [];
  const batch = createSubtitleGenerationBatch({
    probeDuration: async () => 1000,
    run: async (input) => {
      calls.push(input.videoPath);
      expect(input.language).toBe("auto");
      expect(input.ranges).toEqual([{ startMs: 0, endMs: 1000 }]);
      if (input.videoPath === "bad.mp4") throw new Error("损坏文件");
      return result(input.videoPath);
    },
    cancel: async () => {},
  });
  batch.add([" a.mp4 ", "bad.mp4", "a.mp4", "b.mp4"]);
  await batch.start();
  expect(calls).toEqual(["a.mp4", "bad.mp4", "b.mp4"]);
  expect(batch.getSnapshot().items.map(item => item.status)).toEqual(["completed", "failed", "completed"]);
  await batch.start();
  expect(calls).toEqual(["a.mp4", "bad.mp4", "b.mp4", "bad.mp4"]);
});

test("读取时停止，不启动识别或后续视频，等待项可以继续", async () => {
  let finishProbe!: (duration: number) => void;
  let runs = 0;
  const batch = createSubtitleGenerationBatch({
    probeDuration: () => new Promise<number>(resolve => { finishProbe = resolve; }),
    run: async input => { runs++; return result(input.videoPath); },
    cancel: async () => {},
  });
  batch.add(["a.mp4", "b.mp4"]);
  const running = batch.start();
  await batch.cancel();
  finishProbe(1000);
  await running;
  expect(runs).toBe(0);
  expect(batch.getSnapshot().items.map(item => item.status)).toEqual(["stopped", "pending"]);
  expect(batch.getSnapshot().running).toBe(false);
});

test("识别时禁止重复启动或修改队列，停止后不启动下一项", async () => {
  let finish!: (value: ReturnType<typeof result>) => void;
  let calls = 0;
  let cancels = 0;
  const batch = createSubtitleGenerationBatch({
    probeDuration: async () => 1000,
    run: () => { calls++; return new Promise(resolve => { finish = resolve; }); },
    cancel: async () => { cancels++; },
  });
  batch.add(["a.mp4", "b.mp4"]);
  const running = batch.start();
  await Promise.resolve();
  await batch.start();
  batch.add(["c.mp4"]);
  batch.clear();
  expect(batch.getSnapshot().items.length).toBe(2);
  batch.reportProgress("a.mp4", 42, "识别中");
  expect(batch.getSnapshot().items[0].percent).toBe(42);
  await batch.cancel();
  finish({ ...result("a.mp4"), stopped: true });
  await running;
  expect(calls).toBe(1);
  expect(cancels).toBe(1);
  expect(batch.getSnapshot().items[1].status).toBe("pending");
});
