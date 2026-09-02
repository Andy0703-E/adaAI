interface WindowRecord {
  timestamps: number[];
}

export class MemorySlidingWindowRateLimiter {
  private store = new Map<string, WindowRecord>();

  constructor(private windowMs: number, private maxRequests: number) {}

  check(key: string): { success: boolean; limit: number; remaining: number; reset: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Filter out timestamps older than windowStart
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const reset = Math.ceil((oldest + this.windowMs - now) / 1000);
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: Math.max(reset, 1),
      };
    }

    record.timestamps.push(now);
    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - record.timestamps.length,
      reset: Math.ceil(this.windowMs / 1000),
    };
  }

  // Periodic cleanup
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      if (record.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}
