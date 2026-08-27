import type { RequestHandler } from "express";

// Semaphore-style gate for expensive endpoints (judge/trace): at most
// `maxConcurrent` sandbox jobs run at once, and at most `maxQueueDepth`
// additional requests wait. Beyond that we fail fast with 429 instead of
// piling up unbounded compiler/GDB containers against the host.
//
// Slots are handed off atomically on release (the releasing request wakes
// exactly one waiter and transfers its slot without ever dropping the
// counter below max), so concurrent spikes can never overshoot the cap.

const DEFAULT_MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS ?? 2));
const DEFAULT_MAX_QUEUE_DEPTH = Math.max(0, Number(process.env.MAX_QUEUE_DEPTH ?? 8));

export function createJobQueue(options?: {
  maxConcurrent?: number;
  maxQueueDepth?: number;
}): RequestHandler {
  const maxConcurrent = Math.max(1, options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT);
  const maxQueueDepth = Math.max(0, options?.maxQueueDepth ?? DEFAULT_MAX_QUEUE_DEPTH);

  let active = 0;
  let waitingCount = 0;
  const waiting: Array<() => void> = [];

  return async (req, res, next) => {
    if (active >= maxConcurrent) {
      if (waitingCount >= maxQueueDepth) {
        res.set("Retry-After", "2");
        res.status(429).json({
          error: "Too many submissions are being processed right now. Please retry shortly.",
        });
        return;
      }
      waitingCount += 1;
      await new Promise<void>((resolve) => waiting.push(resolve));
      // Slot was transferred to us by the releasing request; `active`
      // still counts it, so nothing to increment here.
    } else {
      active += 1;
    }

    // NOTE: Express' next() does not return a promise tied to the downstream
    // handler, so we cannot `await next()` to detect completion. Release the
    // slot when the response finishes (or the socket closes early).
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      const transferTo = waiting.shift();
      if (transferTo) {
        waitingCount -= 1;
        transferTo();
      } else {
        active -= 1;
      }
    };
    res.on("finish", release);
    res.on("close", release);

    await next();
  };
}

export const jobQueue = createJobQueue();
