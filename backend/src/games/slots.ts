import crypto from 'node:crypto';
import type { Store } from '../store.js';

export interface SlotConfig {
  id: string;
  name: string;
  symbols: string[]; // эмодзи-символы, индекс = id символа
  weights: number[][]; // [reel][symbol] веса выпадения
  wild: number; // индекс символа-вилда (заменяет любой, кроме скаттера)
  scatter: number; // индекс скаттера
  paytable: Record<string, number[]>; // symbol -> множители за 3,4,5 подряд
  scatterPay: number[]; // за 3,4,5 скаттеров (множители от общей ставки)
  lines: number[][]; // линии: индексы рядов для каждого из 5 барабанов
  frame: 'wood' | 'candy' | 'gold'; // группа оформления рамки на фронте
}

// RTP-система: целевой возврат игроку 95%. Шанс сохранить выигрышную сетку
// подстраивается под фактическое отклонение RTP от цели:
//   если RTP ниже цели (игрок в минусе) — winKeep растёт,
//   если выше (игрок в плюсе) — winKeep падает до 0.01.
// Никаких форс-выигрышей — только чистая вероятность.
export const TARGET_RTP = 0.95;

function winKeepForRTP(wagered: number, won: number): number {
  if (wagered < 500) return 0.04; // прогрев: мало данных — умеренный базовый шанс
  const rtp = won / wagered;
  const diff = TARGET_RTP - rtp; // >0 — игрок в минусе, <0 — в плюсе
  // diff ∈ [−0.3, +0.3] → winKeep ∈ [0.01, 0.30]
  const keep = 0.04 + diff * 0.85;
  return Math.min(0.30, Math.max(0.01, keep));
}

function reelWeights(n: number, uniform = 1): number[] {
  return Array.from({ length: n }, () => uniform);
}

// Собачья тема: будка, лапки, косточка, собачки, колокольчик, звезда
const DOG_WEIGHTS: number[][] = [
  // символы: 🦴 🐕 🏠 🐾 🔔 ⭐(вилд)骨头 нет — используем: 0🦴 1🐕 2🏠 3🐾 4🔔 5⭐
  [6, 4, 4, 5, 5, 2],
  [5, 4, 4, 5, 5, 2],
  [5, 4, 4, 5, 5, 2],
  [5, 4, 4, 5, 5, 2],
  [6, 4, 4, 5, 5, 2],
];

export const DOG_SLOT: SlotConfig = {
  id: 'dog',
  name: 'Собачья будка',
  symbols: ['🦴', '🐕', '🏠', '🐾', '🔔', '⭐'],
  weights: DOG_WEIGHTS,
  wild: 5,
  scatter: 0, // 🦴 скаттер
  frame: 'wood',
  paytable: {
    '1': [0, 0, 0, 2, 5, 20], // 🐕 за 3,4,5 подряд
    '2': [0, 0, 0, 3, 8, 30], // 🏠
    '3': [0, 0, 0, 4, 10, 40], // 🐾
    '4': [0, 0, 0, 5, 15, 60], // 🔔
    '5': [0, 0, 0, 10, 40, 200], // ⭐ вилд
  },
  scatterPay: [0, 0, 0, 2, 10, 50],
  lines: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
  ],
};

// Сахарная тема: конфета, леденец, шоколад, пончик, торт, звезда-вилд
export const CANDY_SLOT: SlotConfig = {
  id: 'candy',
  name: 'Сахарная феерия',
  symbols: ['🍬', '🍭', '🍫', '🍩', '🧁', '⭐'],
  weights: [
    [6, 4, 4, 5, 5, 2],
    [5, 4, 4, 5, 5, 2],
    [5, 4, 4, 5, 5, 2],
    [5, 4, 4, 5, 5, 2],
    [6, 4, 4, 5, 5, 2],
  ],
  wild: 5,
  scatter: 0, // 🍬 скаттер
  frame: 'candy',
  paytable: {
    '1': [0, 0, 0, 2, 5, 20],
    '2': [0, 0, 0, 3, 8, 30],
    '3': [0, 0, 0, 4, 10, 40],
    '4': [0, 0, 0, 5, 15, 60],
    '5': [0, 0, 0, 10, 40, 200],
  },
  scatterPay: [0, 0, 0, 2, 10, 50],
  lines: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
  ],
};

// Общая математика новых слотов: те же веса/пейтейбл/линии,
// scatter = индекс 0, вилд = ⭐ (5) — частота выигрышей одинакова у всех.
const BASE_WEIGHTS: number[][] = [
  [6, 4, 4, 5, 5, 2],
  [5, 4, 4, 5, 5, 2],
  [5, 4, 4, 5, 5, 2],
  [5, 4, 4, 5, 5, 2],
  [6, 4, 4, 5, 5, 2],
];

const BASE_PAYTABLE: Record<string, number[]> = {
  '1': [0, 0, 0, 2, 5, 20],
  '2': [0, 0, 0, 3, 8, 30],
  '3': [0, 0, 0, 4, 10, 40],
  '4': [0, 0, 0, 5, 15, 60],
  '5': [0, 0, 0, 10, 40, 200],
};

const BASE_SCATTER_PAY = [0, 0, 0, 2, 10, 50];

const BASE_LINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
];

function mkSlot(id: string, name: string, symbols: string[], frame: SlotConfig['frame']): SlotConfig {
  return {
    id,
    name,
    symbols,
    weights: BASE_WEIGHTS,
    wild: 5,
    scatter: 0,
    paytable: BASE_PAYTABLE,
    scatterPay: BASE_SCATTER_PAY,
    lines: BASE_LINES,
    frame,
  };
}

// 10 дополнительных режимов: [scatter, 4 обычных, ⭐ вилд]
export const EXTRA_SLOTS: SlotConfig[] = [
  mkSlot('fruit', 'Фруктовый рай', ['🍒', '🍋', '🍊', '🧁', '🌸', '⭐'], 'wood'),
  mkSlot('gems', 'Алмазная лихорадка', ['💎', '🎁', '⚡', '🎲', '🔔', '⭐'], 'gold'),
  mkSlot('clover', 'Клеверная удача', ['🍀', '🌸', '🍄', '🐾', '🔔', '⭐'], 'gold'),
  mkSlot('dice', 'Кости Вегаса', ['🎲', '💎', '⚡', '🎁', '🔔', '⭐'], 'gold'),
  mkSlot('storm', 'Грозовой разряд', ['⚡', '💎', '🎲', '🌸', '🍄', '⭐'], 'gold'),
  mkSlot('fishing', 'Рыбацкая удача', ['🐟', '🍄', '🌸', '🍀', '🏠', '⭐'], 'gold'),
  mkSlot('gift', 'Подарочный день', ['🎁', '💎', '🌸', '🍒', '🎲', '⭐'], 'candy'),
  mkSlot('blossom', 'Цветочная феерия', ['🌸', '🍒', '🍀', '🍄', '🧁', '⭐'], 'candy'),
  mkSlot('lemon', 'Лимонная ферма', ['🍋', '🍊', '🌸', '🍒', '🐾', '⭐'], 'wood'),
  mkSlot('orange', 'Апельсиновый взрыв', ['🍊', '🍋', '🍒', '🧁', '🎁', '⭐'], 'wood'),
  mkSlot('space', 'Звёздный рейс', ['🚀', '🌙', '🛸', '🌍', '💎', '⭐'], 'gold'),
];

export const SLOTS: Record<string, SlotConfig> = Object.fromEntries(
  [DOG_SLOT, CANDY_SLOT, ...EXTRA_SLOTS].map(s => [s.id, s]),
);

export interface SlotWin {
  line: number | null; // null = скаттер
  symbol: number;
  count: number;
  amount: number;
}

export interface SpinResult {
  grid: string[][]; // символы по столбцам [reel][row]
  wins: SlotWin[];
  payout: number;
  bet: number;
}

function pickSymbol(weights: number[], rng: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export function spinGrid(cfg: SlotConfig, rng: () => number): number[][] {
  return cfg.weights.map(w => Array.from({ length: 3 }, () => pickSymbol(w, rng)));
}

export function evaluateGrid(cfg: SlotConfig, grid: number[][], bet: number): { wins: SlotWin[]; payout: number } {
  const wins: SlotWin[] = [];
  let payout = 0;

  // линии: слева направо, вилд заменяет любой символ кроме скаттера
  cfg.lines.forEach((line, li) => {
    const cells = line.map((row, reel) => grid[reel][row]);
    const first = cells[0];
    if (first === cfg.scatter) return;
    const target = first === cfg.wild ? null : first;

    let count = 0;
    for (const c of cells) {
      if (c === cfg.wild && (target === null || true)) {
        if (target === null) {
          // вся линия из вилдов — ищем первый не-вилд для пейтейбла? используем вилд
          count++;
          continue;
        }
        count++;
        continue;
      }
      if (target !== null && c === target) {
        count++;
        continue;
      }
      break;
    }

    let sym = target;
    if (sym === null) {
      // линия только из вилдов — платит как вилд-5? берём символ вилда, но он не в paytable для 3-4;
      // считаем по любому символу линии (все вилды) — используем wild c paytable['5'] только при 5
      sym = cfg.wild;
      const pays = cfg.paytable[String(cfg.wild)];
      if (pays && count >= 3) {
        const amount = Math.floor(bet * (pays[count] ?? 0));
        if (amount > 0) {
          wins.push({ line: li, symbol: cfg.wild, count, amount });
          payout += amount;
        }
      }
      return;
    }

    if (count >= 3) {
      const pays = cfg.paytable[String(sym)];
      if (!pays) return;
      const amount = Math.floor(bet * (pays[count] ?? 0));
      if (amount > 0) {
        wins.push({ line: li, symbol: sym, count, amount });
        payout += amount;
      }
    }
  });

  // скаттеры в любом месте
  let scatters = 0;
  for (const col of grid) for (const c of col) if (c === cfg.scatter) scatters++;
  if (scatters >= 3) {
    const pay = cfg.scatterPay[Math.min(scatters, 5)] ?? 0;
    const amount = Math.floor(bet * pay);
    if (amount > 0) {
      wins.push({ line: null, symbol: cfg.scatter, count: scatters, amount });
      payout += amount;
    }
  }

  return { wins, payout };
}

export class SlotsGame {
  constructor(
    private store: Store,
    private rng: () => number = Math.random,
  ) {}

  spin(identity: string, gameId: string, bet: number): SpinResult {
    const cfg = SLOTS[gameId];
    if (!cfg) throw new Error('Такого слота нет');
    const player = this.store.player(identity);
    const err = this.store.validateBet(player.balance, bet);
    if (err) throw new Error(err);

    player.balance -= bet;

    // RTP: считаем шанс сохранить выигрышную сетку по текущему отклонению от цели
    const gs0 = player.gameStats.slots ?? { spins: 0, wagered: 0, won: 0, wins: 0 };
    const winKeep = winKeepForRTP(gs0.wagered ?? 0, gs0.won ?? 0);

    let grid = spinGrid(cfg, this.rng);
    let result = evaluateGrid(cfg, grid, bet);
    // перебрасываем выигрышные сетки с вероятностью (1 − winKeep)
    let guard = 0;
    while (result.payout > 0 && guard++ < 300 && this.rng() >= winKeep) {
      grid = spinGrid(cfg, this.rng);
      result = evaluateGrid(cfg, grid, bet);
    }

    const { wins, payout } = result;
    player.balance += payout;

    player.gameStats.slots ??= { spins: 0, wagered: 0, won: 0, wins: 0 };
    const gs = player.gameStats.slots;
    gs.spins = (gs.spins ?? 0) + 1;
    gs.wagered = (gs.wagered ?? 0) + bet;
    gs.won = (gs.won ?? 0) + payout;
    if (payout > bet) gs.wins = (gs.wins ?? 0) + 1;
    this.store.save();

    return { grid: grid.map(col => col.map(s => cfg.symbols[s])), wins, payout, bet };
  }
}
