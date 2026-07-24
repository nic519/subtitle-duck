type PendingConsumer = {
  resolve: (paths: string[]) => void;
  timer: ReturnType<typeof setTimeout>;
};

export const createLocalFileDropBroker = ({
  waitTimeoutMs = 1_500,
  queuedDropMaxAgeMs = 2_000,
  replacementDelayMs = 25,
  now = Date.now,
}: {
  waitTimeoutMs?: number;
  queuedDropMaxAgeMs?: number;
  replacementDelayMs?: number;
  now?: () => number;
} = {}) => {
  let queuedDrops: Array<{ paths: string[]; receivedAt: number }> = [];
  const pendingConsumers: PendingConsumer[] = [];

  const settle = (pending: PendingConsumer, paths: string[]) => {
    clearTimeout(pending.timer);
    const index = pendingConsumers.indexOf(pending);
    if (index >= 0) pendingConsumers.splice(index, 1);
    pending.resolve(paths);
  };

  const waitForReplacement = (
    candidatePaths: string[],
    timeoutMs: number,
  ): Promise<string[]> =>
    new Promise((resolve) => {
      const pending = {} as PendingConsumer;
      pending.resolve = resolve;
      pending.timer = setTimeout(
        () => settle(pending, candidatePaths),
        timeoutMs,
      );
      pendingConsumers.push(pending);
    });

  const publish = (paths: string[]): void => {
    if (paths.length === 0) return;
    const pending = pendingConsumers[0];
    if (pending) {
      settle(pending, paths);
      return;
    }
    queuedDrops.push({ paths, receivedAt: now() });
  };

  const consume = (): Promise<string[]> => {
    queuedDrops = queuedDrops.filter(
      (drop) => now() - drop.receivedAt <= queuedDropMaxAgeMs,
    );
    const candidate = queuedDrops.shift();
    return waitForReplacement(
      candidate?.paths ?? [],
      candidate ? replacementDelayMs : waitTimeoutMs,
    );
  };

  return { publish, consume };
};
