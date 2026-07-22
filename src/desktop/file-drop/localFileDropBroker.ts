type PendingConsumer = {
  resolve: (paths: string[]) => void;
  timer: ReturnType<typeof setTimeout>;
};

const waitTimeoutMs = 1_500;
const queuedDropMaxAgeMs = 2_000;

export const createLocalFileDropBroker = () => {
  let queuedDrop: { paths: string[]; receivedAt: number } | null = null;
  let pendingConsumer: PendingConsumer | null = null;

  const publish = (paths: string[]): void => {
    if (paths.length === 0) return;
    if (pendingConsumer) {
      clearTimeout(pendingConsumer.timer);
      pendingConsumer.resolve(paths);
      pendingConsumer = null;
      return;
    }
    queuedDrop = { paths, receivedAt: Date.now() };
  };

  const consume = (): Promise<string[]> => {
    if (
      queuedDrop &&
      Date.now() - queuedDrop.receivedAt <= queuedDropMaxAgeMs
    ) {
      const candidatePaths = queuedDrop.paths;
      queuedDrop = null;
      return new Promise((resolve) => {
        pendingConsumer = {
          resolve,
          timer: setTimeout(() => {
            pendingConsumer = null;
            resolve(candidatePaths);
          }, 25),
        };
      });
    }
    queuedDrop = null;

    return new Promise((resolve) => {
      pendingConsumer = {
        resolve,
        timer: setTimeout(() => {
          pendingConsumer = null;
          resolve([]);
        }, waitTimeoutMs),
      };
    });
  };

  return { publish, consume };
};
