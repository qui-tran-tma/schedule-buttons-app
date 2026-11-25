// Seq allocation + pending-reply map. Pure (timers injectable), unit-testable.
import { ErrorCode, Response } from '@/proto/power_board';
import { BoardError, RequestTimeoutError } from './codec';

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

interface Entry {
  kind: string;
  resolve(r: Response): void;
  reject(e: Error): void;
  timer: unknown;
}

const MAX_SEQ = 0xffffffff;

export class PendingRequests {
  private seq = 0;
  private readonly entries = new Map<number, Entry>();

  constructor(private readonly timers: Timers = defaultTimers) {}

  /** Next seq, 1..2^32-1, never 0 (0 = unsolicited). */
  nextSeq(): number {
    this.seq = this.seq >= MAX_SEQ ? 1 : this.seq + 1;
    return this.seq;
  }

  get size(): number {
    return this.entries.size;
  }

  /** Wait for the Response with this seq. Rejects on timeout or non-zero ErrorCode. */
  wait(seq: number, kind: string, timeoutMs: number): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      const timer = this.timers.setTimeout(() => {
        this.entries.delete(seq);
        reject(new RequestTimeoutError(seq, kind));
      }, timeoutMs);
      this.entries.set(seq, { kind, resolve, reject, timer });
    });
  }

  /** Feed every decoded Response. Returns true if it matched a pending request. */
  handle(response: Response): boolean {
    if (response.seq === 0) return false;
    const entry = this.entries.get(response.seq);
    if (!entry) return false;
    this.entries.delete(response.seq);
    this.timers.clearTimeout(entry.timer);
    if (response.error !== ErrorCode.ERROR_NONE) {
      entry.reject(new BoardError(response.error, response));
    } else {
      entry.resolve(response);
    }
    return true;
  }

  /** Fail one request early (e.g. the BLE write itself failed). */
  fail(seq: number, error: Error): void {
    const entry = this.entries.get(seq);
    if (!entry) return;
    this.entries.delete(seq);
    this.timers.clearTimeout(entry.timer);
    entry.reject(error);
  }

  rejectAll(error: Error): void {
    for (const [seq] of this.entries) this.fail(seq, error);
  }
}
