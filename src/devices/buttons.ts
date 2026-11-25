// Button press presets + helpers.
import { PressButton } from '@/proto/power_board';

export const SINGLE_CLICK_HOLD_MS = 150;
export const DEFAULT_GAP_MS = 250;
export const SCHEDULED_PRESS: Omit<PressButton, 'buttonId'> = { pressCount: 1, holdMs: 1000, gapMs: 0 };

export function press(buttonId: number, pressCount: number, holdMs: number, gapMs = 0): PressButton {
  return { buttonId, pressCount, holdMs, gapMs: pressCount > 1 ? gapMs : 0 };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Parse a numeric text input; returns null if not a finite number. */
export function parseNum(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) ? n : null;
}
