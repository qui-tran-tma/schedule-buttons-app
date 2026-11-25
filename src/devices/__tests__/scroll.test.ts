import { cmToMm, formatCm, inRange } from '../scroll';

describe('scroll helpers', () => {
  it('parses cm to whole mm', () => {
    expect(cmToMm('12')).toBe(120);
    expect(cmToMm('2.34')).toBe(23);
    expect(cmToMm('2,5')).toBe(25);
    expect(cmToMm(' -1.5 ')).toBe(-15);
    expect(cmToMm('')).toBeNull();
    expect(cmToMm('abc')).toBeNull();
  });

  it('formats mm as cm', () => {
    expect(formatCm(123)).toBe('12.3 cm');
    expect(formatCm(0)).toBe('0.0 cm');
    expect(formatCm(-5)).toBe('-0.5 cm');
  });

  it('checks range inclusive', () => {
    expect(inRange(0, 0, 1000)).toBe(true);
    expect(inRange(1000, 0, 1000)).toBe(true);
    expect(inRange(1001, 0, 1000)).toBe(false);
    expect(inRange(-1, 0, 1000)).toBe(false);
  });
});
