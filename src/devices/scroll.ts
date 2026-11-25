// Scroll servo helpers. Board works in whole mm; the app shows and takes cm.

/** Parse a cm text input to whole mm. Null if empty or not a finite number. */
export function cmToMm(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 10) : null;
}

/** mm -> "12.3 cm". */
export function formatCm(mm: number): string {
  return `${(mm / 10).toFixed(1)} cm`;
}

/** True if mm lies in the board's travel range (inclusive). */
export function inRange(mm: number, minMm: number, maxMm: number): boolean {
  return mm >= minMm && mm <= maxMm;
}
