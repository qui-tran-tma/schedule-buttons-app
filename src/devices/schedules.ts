// Pure schedule helpers (unit-testable).
import { Channel, Schedule } from '@/proto/power_board';

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const EVERY_DAY = 0x7f;
export const WEEKDAYS_MON_FRI = 0x1f;

/** Slot ids (1-based) set in Status.schedule_mask, limited to maxSchedules. */
export function usedSlots(mask: number, maxSchedules: number): number[] {
  const ids: number[] = [];
  for (let id = 1; id <= Math.min(maxSchedules, 32); id++) {
    if ((mask >>> (id - 1)) & 1) ids.push(id);
  }
  return ids;
}

/** First free slot id, or null when full. */
export function firstFreeSlot(mask: number, maxSchedules: number): number | null {
  for (let id = 1; id <= Math.min(maxSchedules, 32); id++) {
    if (!((mask >>> (id - 1)) & 1)) return id;
  }
  return null;
}

export function formatMinuteOfDay(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Bit 0 = Monday ... bit 6 = Sunday. 0 = "Once". */
export function weekdaysLabel(weekdays: number): string {
  const w = weekdays & EVERY_DAY;
  if (w === 0) return 'Once';
  if (w === EVERY_DAY) return 'Every day';
  if (w === WEEKDAYS_MON_FRI) return 'Weekdays';
  if (w === 0x60) return 'Weekends';
  return WEEKDAY_LABELS.filter((_, i) => (w >> i) & 1).join(' ');
}

export function toggleWeekday(weekdays: number, dayIndex: number): number {
  return (weekdays ^ (1 << dayIndex)) & EVERY_DAY;
}

export function channelLabel(ch: Channel): string {
  return ch >= 1 && ch <= 3 ? `CH${ch}` : `CH?`;
}

export function actionSummary(s: Schedule): string {
  const a = s.action;
  if (!a) return 'No action';
  if (a.$case === 'relay') return `${channelLabel(a.relay.channel)} ${a.relay.powerOn ? 'ON' : 'OFF'}`;
  const p = a.press;
  const count = p.pressCount <= 1 ? 'Press' : `Press x${p.pressCount}`;
  return `${count} (hold ${(p.holdMs / 1000).toFixed(p.holdMs % 1000 === 0 ? 0 : 1)} s)`;
}

/** Board clock as local wall time string, e.g. "2026-11-14 20:31 (UTC+10:00)". */
export function formatBoardClock(unixS: number, utcOffsetMin: number): string {
  if (!unixS) return 'not set';
  const d = new Date((unixS + utcOffsetMin * 60) * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const sign = utcOffsetMin < 0 ? '-' : '+';
  const off = Math.abs(utcOffsetMin);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} (UTC${sign}${pad(Math.floor(off / 60))}:${pad(off % 60)})`
  );
}
