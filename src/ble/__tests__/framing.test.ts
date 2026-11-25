import { ErrorCode, Profile, Request, Response } from '@/proto/power_board';
import { base64ToBytes, bytesToBase64 } from '../base64';
import { BoardError, decodeResponse, encodeRequest, RequestTimeoutError } from '../codec';
import { MAX_FRAME } from '../constants';
import { PendingRequests, Timers } from '../pending';

describe('base64', () => {
  it('round-trips all lengths', () => {
    for (let n = 0; n < 20; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 0xff);
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });
  it('matches known vectors', () => {
    expect(bytesToBase64(new Uint8Array([0x08, 0x01, 0x32, 0x00]))).toBe('CAEyAA==');
    expect(Array.from(base64ToBytes('CAEyAA=='))).toEqual([8, 1, 50, 0]);
  });
});

describe('codec', () => {
  it('encodes GetInfo with seq', () => {
    // field 1 varint seq=1, field 6 (get_info) empty message
    expect(Array.from(encodeRequest(1, { $case: 'getInfo', getInfo: {} }))).toEqual([0x08, 0x01, 0x32, 0x00]);
  });

  it('encodes SetTime 64-bit and negative offset', () => {
    const bytes = encodeRequest(7, { $case: 'setTime', setTime: { unixS: 1_800_000_000, utcOffsetMin: -300 } });
    expect(bytes.length).toBeLessThanOrEqual(MAX_FRAME);
  });

  it('stays under the frame cap for the largest request', () => {
    const bytes = encodeRequest(0xffffffff, {
      $case: 'setSchedule',
      setSchedule: {
        schedule: {
          id: 32,
          enabled: true,
          minuteOfDay: 1439,
          weekdays: 0x7f,
          action: { $case: 'press', press: { buttonId: 4, pressCount: 10, holdMs: 30000, gapMs: 10000 } },
        },
      },
    });
    expect(bytes.length).toBeLessThanOrEqual(MAX_FRAME);
  });

  it('decodes a Response with info', () => {
    const bytes = Response.encode({
      seq: 3,
      error: ErrorCode.ERROR_NONE,
      payload: {
        $case: 'info',
        info: { profile: Profile.PROFILE_BUTTON_TESTER, fwVersion: '0.3.0', relayCount: 0, buttonCount: 1, maxSchedules: 8,
          sleepIntervalS: 60, awakeWindowMs: 2000, idleDisconnectS: 180, scrollMinMm: 0, scrollMaxMm: 0 },
      },
    }).finish();
    const r = decodeResponse(bytes);
    expect(r.seq).toBe(3);
    expect(r.payload?.$case === 'info' && r.payload.info.fwVersion).toBe('0.3.0');
  });

  it('round-trips scroll requests and status (negative mm, sint32)', () => {
    const req = Request.decode(encodeRequest(9, { $case: 'moveScroll', moveScroll: { deltaMm: -125 } }));
    expect(req.payload).toEqual({ $case: 'moveScroll', moveScroll: { deltaMm: -125 } });
    const bytes = Response.encode({
      seq: 0,
      error: ErrorCode.ERROR_NONE,
      payload: {
        $case: 'status',
        status: { relays: [], uptimeS: 1, buttons: [], unixS: 0, scheduleMask: 0, utcOffsetMin: 0,
          scroll: { positionMm: 340, targetMm: 500, moving: true } },
      },
    }).finish();
    const r = decodeResponse(bytes);
    expect(r.payload?.$case === 'status' && r.payload.status.scroll).toEqual({ positionMm: 340, targetMm: 500, moving: true });
  });
});

function fakeTimers() {
  const fns = new Map<number, () => void>();
  let id = 0;
  const timers: Timers = {
    setTimeout: (fn) => {
      fns.set(++id, fn);
      return id;
    },
    clearTimeout: (h) => void fns.delete(h as number),
  };
  return { timers, fireAll: () => [...fns.values()].forEach((f) => f()), count: () => fns.size };
}

const status = (seq: number, error = ErrorCode.ERROR_NONE): Response => ({
  seq,
  error,
  payload: {
    $case: 'status',
    status: { relays: [], uptimeS: 1, buttons: [], unixS: 0, scheduleMask: 0, utcOffsetMin: 0, scroll: undefined },
  },
});

describe('PendingRequests', () => {
  it('never hands out seq 0 and wraps', () => {
    const p = new PendingRequests(fakeTimers().timers);
    expect(p.nextSeq()).toBe(1);
    (p as unknown as { seq: number }).seq = 0xffffffff;
    expect(p.nextSeq()).toBe(1);
  });

  it('resolves by seq and ignores seq 0 / unknown seq', async () => {
    const t = fakeTimers();
    const p = new PendingRequests(t.timers);
    const a = p.wait(1, 'getStatus', 3000);
    const b = p.wait(2, 'getStatus', 3000);
    expect(p.handle(status(0))).toBe(false);
    expect(p.handle(status(99))).toBe(false);
    expect(p.handle(status(2))).toBe(true);
    expect(p.handle(status(1))).toBe(true);
    await expect(a).resolves.toMatchObject({ seq: 1 });
    await expect(b).resolves.toMatchObject({ seq: 2 });
    expect(t.count()).toBe(0);
    expect(p.size).toBe(0);
  });

  it('rejects with BoardError on ErrorCode', async () => {
    const p = new PendingRequests(fakeTimers().timers);
    const a = p.wait(5, 'pressButton', 3000);
    p.handle(status(5, ErrorCode.ERROR_BUSY));
    await expect(a).rejects.toBeInstanceOf(BoardError);
    await expect(a).rejects.toThrow(/busy/);
  });

  it('rejects on timeout and drops the entry', async () => {
    const t = fakeTimers();
    const p = new PendingRequests(t.timers);
    const a = p.wait(9, 'getInfo', 3000);
    t.fireAll();
    await expect(a).rejects.toBeInstanceOf(RequestTimeoutError);
    expect(p.handle(status(9))).toBe(false);
  });

  it('rejectAll fails everything', async () => {
    const p = new PendingRequests(fakeTimers().timers);
    const a = p.wait(1, 'x', 3000);
    const b = p.wait(2, 'y', 3000);
    p.rejectAll(new Error('Disconnected'));
    await expect(a).rejects.toThrow('Disconnected');
    await expect(b).rejects.toThrow('Disconnected');
  });
});
