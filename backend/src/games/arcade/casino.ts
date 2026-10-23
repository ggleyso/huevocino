import type { Store } from '../../store.js';
import { takeBet, settle, num, type ArcadeGame, type ArcadeMeta } from './common.js';

// ---------- 🎡 Рулетка (европейская, 37 секторов 0-36) ----------
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const PAYS: Record<string, number> = {
  straight: 35, // одно число
  red: 1, black: 1, even: 1, odd: 1, low: 1, high: 1,
  dozen: 2, column: 2,
  split: 17, street: 11, corner: 8, sixline: 5,
};

export class RouletteGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'roulette', name: 'Рулетка', icon: '🎯', desc: 'Европейская рулетка: числа, цвета, дюжины, колонки', tag: 'Карты' };
  private states = new Map<string, { last: { num: number; color: string; payout: number } | null }>();

  constructor(private store: Store) {}

  view(identity: string) {
    return { last: this.states.get(identity)?.last ?? null, red: [...RED] };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'bet') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    const type = String(body.type ?? '');
    const value = body.value !== undefined ? Number(body.value) : -1;
    takeBet(this.store, identity, bet);

    const n = Math.floor(Math.random() * 37); // 0-36
    const color = n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
    let mult = 0;

    switch (type) {
      case 'straight': mult = n === value ? PAYS.straight : 0; break;
      case 'red': mult = color === 'red' ? PAYS.red : 0; break;
      case 'black': mult = color === 'black' ? PAYS.black : 0; break;
      case 'even': mult = n !== 0 && n % 2 === 0 ? PAYS.even : 0; break;
      case 'odd': mult = n !== 0 && n % 2 === 1 ? PAYS.odd : 0; break;
      case 'low': mult = n >= 1 && n <= 18 ? PAYS.low : 0; break;
      case 'high': mult = n >= 19 && n <= 36 ? PAYS.high : 0; break;
      case 'dozen': mult = n >= value * 12 - 11 && n <= value * 12 ? PAYS.dozen : 0; break;
      case 'column': mult = n !== 0 && n % 3 === value % 3 ? PAYS.column : 0; break;
      default: mult = 0;
    }

    const payout = Math.floor(bet * (mult + 1)); // вернуть ставку + выигрыш
    const win = mult > 0;
    settle(this.store, identity, 'roulette', bet, win ? payout : 0, win);
    const last = { num: n, color, payout: win ? payout - bet : 0 };
    this.states.set(identity, { last });
    return { last, balance: this.store.player(identity).balance };
  }
}

// ---------- 🎱 Плинко ----------
const PLINKO_RISKS: Record<string, { label: string; multipliers: number[] }> = {
  low: { label: 'Низкий', multipliers: [16, 9, 2, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 2, 9, 16] },
  mid: { label: 'Средний', multipliers: [32, 11, 3.8, 1.9, 1.1, 0.57, 0.28, 0.57, 1.1, 1.9, 3.8, 11, 32] },
  high: { label: 'Высокий', multipliers: [110, 41, 10, 3, 1.3, 0.4, 0.2, 0.4, 1.3, 3, 10, 41, 110] },
};

export class PlinkoGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'plinko', name: 'Плинко', icon: '🎱', desc: 'Шарик падает через ряды шипов в лунку с множителем', tag: 'Шанс' };
  private states = new Map<string, { last: { mult: number; payout: number; slot: number } | null }>();

  constructor(private store: Store) {}

  view(identity: string) {
    return {
      last: this.states.get(identity)?.last ?? null,
      risks: Object.entries(PLINKO_RISKS).map(([id, r]) => ({ id, label: r.label, multipliers: r.multipliers })),
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'drop') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    const risk = String(body.risk ?? 'mid') as keyof typeof PLINKO_RISKS;
    const cfg = PLINKO_RISKS[risk] ?? PLINKO_RISKS.mid;
    takeBet(this.store, identity, bet);

    // симуляция падения: 12 рядов шипов, шарик выбирает влево/вправо
    const rows = cfg.multipliers.length - 1;
    let pos = Math.floor(rows / 2);
    const path: number[] = [];
    for (let i = 0; i < rows; i++) {
      pos += Math.random() < 0.5 ? 0 : 1;
      path.push(pos);
    }
    const slot = Math.min(cfg.multipliers.length - 1, Math.max(0, pos));
    const mult = cfg.multipliers[slot];
    const payout = Math.floor(bet * mult);
    const win = mult >= 1;
    settle(this.store, identity, 'plinko', bet, payout, win);
    const last = { mult, payout: payout > 0 ? payout - bet : -bet, slot };
    this.states.set(identity, { last });
    return { last, path, balance: this.store.player(identity).balance };
  }
}

// ---------- 🎈 Шарик (loonie) ----------
export class BalloonGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'balloon', name: 'Шарик', icon: '🎈', desc: 'Надувай шарик — множитель растёт, но может лопнуть', tag: 'Риск' };
  private sessions = new Map<string, { bet: number; mult: number; pumps: number; done: boolean; cashed: boolean; payout: number }>();

  constructor(private store: Store) {}

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    return {
      phase: s.done ? 'done' : 'play',
      mult: Number(s.mult.toFixed(2)),
      pumps: s.pumps,
      payout: s.cashed ? s.payout : 0,
      bet: s.bet,
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);

    if (action === 'start') {
      if (s && !s.done) throw new Error('Раунд уже идёт');
      const bet = num(body.bet, 0);
      takeBet(this.store, identity, bet);
      this.sessions.set(identity, { bet, mult: 1, pumps: 0, done: false, cashed: false, payout: 0 });
      return this.view(identity);
    }

    if (!s || s.done) throw new Error('Нет активного раунда');

    if (action === 'pump') {
      // шанс лопнуть растёт с каждым качком: base 12%, +2% за качок
      const popChance = Math.min(0.45, 0.12 + s.pumps * 0.02);
      if (Math.random() < popChance) {
        s.done = true;
        settle(this.store, identity, 'balloon', s.bet, 0, false);
        return this.view(identity);
      }
      s.pumps += 1;
      // множитель растёт экспоненциально
      s.mult = 1 + s.pumps * 0.15 + s.pumps * s.pumps * 0.03;
      return this.view(identity);
    }

    if (action === 'cashout') {
      if (s.pumps === 0) throw new Error('Качни хотя бы раз');
      s.done = true;
      s.cashed = true;
      s.payout = Math.floor(s.bet * s.mult);
      settle(this.store, identity, 'balloon', s.bet, s.payout, true);
      return this.view(identity);
    }

    throw new Error('Неизвестное действие');
  }
}
