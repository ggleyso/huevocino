import { describe, it, expect } from 'vitest';
import { Store } from '../src/store.js';
import { SlotsGame, DOG_SLOT, CANDY_SLOT, evaluateGrid, SLOTS } from '../src/games/slots.js';

// символы dog/candy: 0=скаттер, 1..4 обычные, 5=⭐ вилд
// сетка: [reel][row], ряды 0(top) 1(mid) 2(bottom)
const g = (cols: number[][]): number[][] => cols;

describe('слоты: конфигурация', () => {
  it('все 13 слотов зарегистрированы, веса корректны', () => {
    expect(Object.keys(SLOTS).sort()).toEqual([
      'blossom',
      'candy',
      'clover',
      'dice',
      'dog',
      'fishing',
      'fruit',
      'gems',
      'gift',
      'lemon',
      'orange',
      'space',
      'storm',
    ]);
    for (const cfg of Object.values(SLOTS)) {
      expect(cfg.weights.length).toBe(5);
      for (const w of cfg.weights) expect(w.length).toBe(cfg.symbols.length);
      expect(cfg.lines.every(l => l.length === 5 && l.every(r => r >= 0 && r < 3))).toBe(true);
      expect(cfg.symbols[cfg.wild]).toBe('⭐');
      expect(cfg.scatter).toBe(0);
      if (cfg.id === 'dog') expect(cfg.symbols[0]).toBe('🦴');
      if (cfg.id === 'candy') expect(cfg.symbols[0]).toBe('🍬');
      expect(new Set(cfg.symbols).size).toBe(6);
      expect(['wood', 'candy', 'gold']).toContain(cfg.frame);
      for (const pays of Object.values(cfg.paytable)) expect(pays.length).toBe(6);
    }
  });
});

describe('слоты: оценка сетки', () => {
  it('три одинаковых по верхней линии = выплата по пейтейблу', () => {
    // верхняя линия (line 1): 🐕 🐕 🐕 4 🔔 → 3×🐕 ×2 от ставки; скаттеров ≤2
    const grid = g([[1, 4, 2], [1, 2, 4], [1, 3, 4], [3, 1, 4], [4, 3, 2]]);
    const { wins, payout } = evaluateGrid(DOG_SLOT, grid, 100);
    const lineWin = wins.find(w => w.line === 1);
    expect(lineWin).toMatchObject({ symbol: 1, count: 3, amount: 200 });
    expect(payout).toBe(200);
  });

  it('вилд ⭐ заменяет: 🐕 🐕 ⭐ = тройка 🐕, и лишние выигрыши не платятся дважды', () => {
    // верх: 🐕 🐕 ⭐ → 3×🐕; остальные линии без троек; скаттеров нет
    const grid = g([[1, 1, 2], [1, 4, 3], [5, 3, 2], [4, 2, 3], [4, 3, 2]]);
    const { wins, payout } = evaluateGrid(DOG_SLOT, grid, 100);
    expect(wins.filter(w => w.line !== null).length).toBe(1);
    expect(wins[0]).toMatchObject({ line: 1, symbol: 1, count: 3 });
    expect(payout).toBe(200);
  });

  it('пять 🏠 по линии = ×30', () => {
    // верх: 5×🏠; скаттеров ≤2
    const grid = g([[2, 4, 1], [2, 3, 4], [2, 4, 1], [2, 1, 4], [2, 3, 1]]);
    const { payout, wins } = evaluateGrid(DOG_SLOT, grid, 10);
    expect(wins.some(w => w.symbol === 2 && w.count === 5)).toBe(true);
    expect(payout).toBe(300);
  });

  it('две одинаковые — не платят (нужно 3+)', () => {
    const grid = g([[1, 2, 4], [1, 3, 2], [2, 4, 3], [3, 1, 4], [4, 2, 3]]);
    const { wins } = evaluateGrid(DOG_SLOT, grid, 100);
    expect(wins).toHaveLength(0);
  });

  it('3 скаттера в любом месте платят ×2 общей ставки', () => {
    // 🦴 на (0,0), (1,1), (2,2); на линиях начинающихся со скаттера — выигрышей нет
    const grid = g([[0, 4, 2], [3, 0, 4], [1, 2, 0], [3, 4, 2], [4, 3, 1]]);
    const { wins, payout } = evaluateGrid(DOG_SLOT, grid, 100);
    const sc = wins.find(w => w.line === null);
    expect(sc).toMatchObject({ count: 3, amount: 200 });
    expect(wins.filter(w => w.line !== null)).toHaveLength(0);
    expect(payout).toBe(200);
  });

  it('4 скаттера = ×10', () => {
    const grid = g([[0, 4, 2], [3, 0, 4], [1, 2, 0], [3, 4, 0], [4, 3, 1]]);
    const { wins, payout } = evaluateGrid(DOG_SLOT, grid, 100);
    expect(wins.find(w => w.line === null)).toMatchObject({ count: 4, amount: 1000 });
    expect(payout).toBe(1000);
  });

  it('сладкий слот использует свои символы и пейтейбл', () => {
    const cfg = CANDY_SLOT;
    expect(cfg.symbols[1]).toBe('🍭');
    // верх: 🍭 🍭 🍭 4 🔔-аналог → 3×🍭 ×2
    const grid = g([[1, 4, 2], [1, 2, 4], [1, 3, 4], [3, 1, 4], [4, 3, 2]]);
    const { payout } = evaluateGrid(cfg, grid, 100);
    expect(payout).toBe(200);
  });
});

describe('слоты: спин через движок', () => {
  it('ставка списывается, выигрыш начисляется, статистика растёт', () => {
    const store = new Store();
    const game = new SlotsGame(store, () => 0.999);
    const before = store.player('device:dev').balance;
    const res = game.spin('device:dev', 'dog', 100);
    expect(res.bet).toBe(100);
    expect(res.grid.length).toBe(5);
    expect(res.grid[0].length).toBe(3);
    expect(store.player('device:dev').balance).toBe(before - 100 + res.payout);
    expect(store.player('device:dev').gameStats.slots).toMatchObject({ spins: 1, wagered: 100, won: res.payout });
  });

  it('неизвестный слот и плохая ставка — отказ', () => {
    const store = new Store();
    const game = new SlotsGame(store);
    expect(() => game.spin('device:dev', 'nope', 100)).toThrowError('Такого слота нет');
    expect(() => game.spin('device:dev', 'dog', 5)).toThrowError('Минимальная ставка 10');
    expect(() => game.spin('device:dev', 'dog', 50000)).toThrowError('Недостаточно монет');
  });

  it('детерминированный rng: сетка воспроизводима', () => {
    let seq = 0;
    const rng = () => (seq++ % 100) / 100;
    const a = new SlotsGame(new Store(), rng).spin('device:dev', 'candy', 50);
    seq = 0;
    const b = new SlotsGame(new Store(), rng).spin('device:dev', 'candy', 50);
    expect(a.grid).toEqual(b.grid);
  });
});
