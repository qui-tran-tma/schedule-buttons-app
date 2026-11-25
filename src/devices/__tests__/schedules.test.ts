import { Channel } from '@/proto/power_board';
import {
  actionSummary,
  firstFreeSlot,
  formatBoardClock,
  formatMinuteOfDay,
  toggleWeekday,
  usedSlots,
  weekdaysLabel,
} from '../schedules';

describe('schedules helpers', () => {
  it('maps mask to slot ids', () => {
    expect(usedSlots(0b1011, 8)).toEqual([1, 2, 4]);
    expect(usedSlots(0xff, 4)).toEqual([1, 2, 3, 4]);
    expect(firstFreeSlot(0b1011, 8)).toBe(3);
    expect(firstFreeSlot(0b1111, 4)).toBeNull();
    expect(firstFreeSlot(0, 0)).toBeNull();
  });

  it('formats time and days', () => {
    expect(formatMinuteOfDay(0)).toBe('00:00');
    expect(formatMinuteOfDay(23 * 60 + 5)).toBe('23:05');
    expect(weekdaysLabel(0)).toBe('Once');
    expect(weekdaysLabel(0x7f)).toBe('Every day');
    expect(weekdaysLabel(0x1f)).toBe('Weekdays');
    expect(weekdaysLabel(0b0000101)).toBe('Mon Wed');
    expect(toggleWeekday(0, 6)).toBe(0x40);
    expect(toggleWeekday(0x40, 6)).toBe(0);
  });

  it('summarises actions', () => {
    const base = { id: 1, enabled: true, minuteOfDay: 0, weekdays: 0 };
    expect(actionSummary({ ...base, action: { $case: 'relay', relay: { channel: Channel.CHANNEL_2, powerOn: false } } })).toBe(
      'CH2 OFF',
    );
    expect(
      actionSummary({ ...base, action: { $case: 'press', press: { buttonId: 1, pressCount: 1, holdMs: 1000, gapMs: 0 } } }),
    ).toBe('Press (hold 1 s)');
  });

  it('formats board clock in board-local time', () => {
    expect(formatBoardClock(0, 600)).toBe('not set');
    // 2026-01-01T00:00:00Z at UTC+10 -> 10:00
    expect(formatBoardClock(1767225600, 600)).toBe('2026-01-01 10:00 (UTC+10:00)');
    expect(formatBoardClock(1767225600, -330)).toBe('2025-12-31 18:30 (UTC-05:30)');
  });
});
