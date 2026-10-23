import { SLOTS, spinGrid, evaluateGrid, WIN_KEEP_P, type SlotConfig } from '../src/games/slots.js';

function measure(cfg: SlotConfig, n = 400000) {
  let pay = 0;
  let hits = 0;
  let maxPay = 0;
  let big = 0; // >= 10x
  for (let i = 0; i < n; i++) {
    let grid = spinGrid(cfg, Math.random);
    let ev = evaluateGrid(cfg, grid, 1);
    let guard = 0;
    while (ev.payout > 0 && guard++ < 300 && Math.random() >= WIN_KEEP_P) {
      grid = spinGrid(cfg, Math.random);
      ev = evaluateGrid(cfg, grid, 1);
    }
    const { payout } = ev;
    pay += payout;
    if (payout > 0) hits++;
    if (payout > maxPay) maxPay = payout;
    if (payout >= 10) big++;
  }
  return {
    id: cfg.id,
    rtp: ((pay / n) * 100).toFixed(2) + '%',
    hitFreq: ((hits / n) * 100).toFixed(1) + '%',
    maxPay: maxPay + 'x',
    freq10x: ((big / n) * 100).toFixed(2) + '%',
  };
}

console.log(measure(SLOTS['dog']));
console.log(measure(SLOTS['candy']));
console.log(measure(SLOTS['fruit']));
console.log(measure(SLOTS['gems']));
