import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Bound concurrent response work without retaining an unbounded waiting queue. */
export class RuntimeGuardrails {
  private readonly logger = new Logger('RuntimeMemory');
  private active = 0;
  private peak = 0;
  private completed = 0;
  private rejected = 0;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly maxInFlight: number) {}

  readonly middleware = (_req: Request, res: Response, next: NextFunction) => {
    if (this.active >= this.maxInFlight) {
      this.rejected++;
      res.setHeader('Retry-After', '5');
      res.status(503).json({
        success: false,
        statusCode: 503,
        message: 'Server busy. Please retry shortly.',
      });
      return;
    }
    this.active++;
    this.peak = Math.max(this.peak, this.active);
    const release = () => {
      // A normal response emits both finish and close. Release exactly once,
      // and remove both listeners on aborted connections as well.
      res.off('finish', release);
      res.off('close', release);
      this.active--;
      this.completed++;
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };

  snapshot() {
    const memory = process.memoryUsage();
    const result = {
      runtime: process.versions.bun
        ? `bun/${process.versions.bun}`
        : process.version,
      uptimeSeconds: Math.round(process.uptime()),
      rssMiB: Math.round(memory.rss / 1024 / 1024),
      heapUsedMiB: Math.round(memory.heapUsed / 1024 / 1024),
      externalMiB: Math.round(memory.external / 1024 / 1024),
      arrayBuffersMiB: Math.round(memory.arrayBuffers / 1024 / 1024),
      activeResponses: this.active,
      peakResponses: this.peak,
      completedResponses: this.completed,
      rejectedRequests: this.rejected,
    };
    this.peak = this.active;
    this.completed = 0;
    this.rejected = 0;
    return result;
  }

  start(intervalMs: number) {
    this.stop();
    this.logger.log(JSON.stringify(this.snapshot()));
    this.timer = setInterval(() => {
      this.logger.log(JSON.stringify(this.snapshot()));
    }, intervalMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
