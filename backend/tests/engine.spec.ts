import { describe, it, expect } from 'vitest';
import { rollCrash, multiplierAt, crashTimeMs, payoutFor, calcCommission, HOUSE_EDGE } from '../src/engine.js';

describe('crash-логика', () => {
  it('краш всегда >= 1.00, две цифры после запятой', () => {
    for (let i = 0; i < 10000; i++) {
      const c = rollCrash(i / 10000);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeCloseTo(Math.round(c * 100) / 100, 9);
    }
  });

  it('краш при r=0 (мгновенный) = 1.00', () => {
    expect(rollCrash(0)).toBe(1);
  });

  it('детерминированные значения', () => {
    expect(rollCrash(0.5)).toBe(1.94);
    expect(rollCrash(0.9)).toBe(9.7);
  });

  it('распределение: ~50% раундов ниже 2x, ~1% выше 100x', () => {
    let below2 = 0;
    let above100 = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const c = rollCrash(i / n);
      if (c < 2) below2++;
      if (c >= 100) above100++;
    }
    expect(below2 / n).toBeGreaterThan(0.48);
    expect(below2 / n).toBeLessThan(0.55);
    expect(above100 / n).toBeGreaterThan(0.005);
    expect(above100 / n).toBeLessThan(0.02);
  });

  it('house edge: стратегия «вывести на пороге s» даёт ~0.97 ставки', () => {
    const n = 50000;
    for (const s of [1.1, 1.5, 2, 5, 10]) {
      let wins = 0;
      for (let i = 0; i < n; i++) {
        if (rollCrash(i / n) >= s) wins++;
      }
      const ev = (wins * s) / n;
      expect(ev).toBeGreaterThan(HOUSE_EDGE * 0.9);
      expect(ev).toBeLessThan(HOUSE_EDGE * 1.1);
    }
  });

  it('множитель растёт с временем, обратная связь с crashTimeMs', () => {
    expect(multiplierAt(0)).toBe(1);
    expect(multiplierAt(1000)).toBeGreaterThan(1);
    expect(multiplierAt(2000)).toBeGreaterThan(multiplierAt(1000));
    for (const m of [1.5, 2, 10, 50]) {
      expect(multiplierAt(crashTimeMs(m))).toBeCloseTo(m, 5);
    }
  });

  it('выплата — округление вниз', () => {
    expect(payoutFor(100, 2.5)).toBe(250);
    expect(payoutFor(100, 2.999)).toBe(299);
    expect(payoutFor(10, 1.001)).toBe(10);
  });

  it('комиссия 5% вниз', () => {
    expect(calcCommission(1000, 5, true)).toEqual({ fee: 50, net: 950 });
    expect(calcCommission(1000, 5, false)).toEqual({ fee: 0, net: 1000 });
    expect(calcCommission(109, 5, true)).toEqual({ fee: 5, net: 104 });
  });
});
