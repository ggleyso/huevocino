import type { Store } from '../../store.js';
import { takeBet, settle, num, type ArcadeGame, type ArcadeMeta } from './common.js';

// ---------- 🎲 Кости ----------
interface DiceState {
  last: { roll: number; win: boolean; payout: number } | null;
}

export class DiceGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'dice', name: 'Кости', icon: '🎲', desc: 'Ставь выше или ниже числа — множитель растёт с риском', tag: 'Шанс' };
  private states = new Map<string, DiceState>();

  constructor(private store: Store) {}

  view(identity: string) {
    return { last: this.states.get(identity)?.last ?? null };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'roll') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    const target = Math.min(98, Math.max(2, Math.round(num(body.target, 50))));
    const dir = body.dir === 'lt' ? 'lt' : 'gt';
    const chance = dir === 'gt' ? 100 - target : target;
    const mult = (97 / chance) * (dir === 'gt' ? 1 : 1);
    takeBet(this.store, identity, bet);
    const roll = Math.floor(Math.random() * 100);
    const win = dir === 'gt' ? roll > target : roll < target;
    const payout = win ? Math.floor(bet * mult) : 0;
    settle(this.store, identity, 'dice', bet, payout, win);
    const last = { roll, win, payout, target, dir, mult: Number(mult.toFixed(2)) };
    this.states.set(identity, { last });
    return { last, balance: this.store.player(identity).balance };
  }
}

// ---------- 🪙 Монетка ----------
interface CoinState {
  last: { result: string; pick: string; win: boolean; payout: number } | null;
}

export class CoinGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'coin', name: 'Монетка', icon: '🪙', desc: 'Орёл или решка — чистая удача, ×1.94 за победу', tag: 'Шанс' };
  private states = new Map<string, CoinState>();

  constructor(private store: Store) {}

  view(identity: string) {
    return { last: this.states.get(identity)?.last ?? null };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'flip') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    const side = body.side === 'tails' ? 'tails' : 'heads';
    takeBet(this.store, identity, bet);
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const win = result === side;
    const payout = win ? Math.floor(bet * 1.94) : 0;
    settle(this.store, identity, 'coin', bet, payout, win);
    const last = { result, pick: side, win, payout };
    this.states.set(identity, { last });
    return { last, balance: this.store.player(identity).balance };
  }
}

// ---------- 🎡 Колесо фортуны ----------
interface WheelSeg {
  m: number;
  w: number;
}
const WHEEL_SEGS: WheelSeg[] = [
  { m: 0, w: 42 },
  { m: 0.5, w: 19 },
  { m: 1.1, w: 14 },
  { m: 1.6, w: 9 },
  { m: 2.5, w: 6 },
  { m: 5, w: 4.5 },
  { m: 10, w: 3 },
  { m: 25, w: 1.2 },
  { m: 100, w: 0.3 },
];
const WHEEL_W = WHEEL_SEGS.reduce((a, s) => a + s.w, 0);
const WHEEL_EV = WHEEL_SEGS.reduce((a, s) => a + s.m * s.w, 0) / WHEEL_W;
const WHEEL_SCALE = 0.965 / WHEEL_EV;
export const WHEEL_VIEW = WHEEL_SEGS.map(s => ({ m: Number((s.m * WHEEL_SCALE).toFixed(2)), w: s.w }));

interface WheelState {
  last: { index: number; m: number; payout: number } | null;
}

export class WheelGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'wheel', name: 'Колесо фортуны', icon: '🎡', desc: 'Крути барабан: от ×0 до ×100', tag: 'Шанс' };
  private states = new Map<string, WheelState>();

  constructor(private store: Store) {}

  view(identity: string) {
    return { segs: WHEEL_VIEW, last: this.states.get(identity)?.last ?? null };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'spin') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    takeBet(this.store, identity, bet);
    let r = Math.random() * WHEEL_W;
    let index = 0;
    for (let i = 0; i < WHEEL_SEGS.length; i++) {
      r -= WHEEL_SEGS[i].w;
      if (r < 0) {
        index = i;
        break;
      }
      index = i;
    }
    const m = Number((WHEEL_SEGS[index].m * WHEEL_SCALE).toFixed(2));
    const payout = Math.floor(bet * m);
    settle(this.store, identity, 'wheel', bet, payout, payout > bet);
    const last = { index, m, payout };
    this.states.set(identity, { last });
    return { last, balance: this.store.player(identity).balance };
  }
}

// ---------- ⚽ Пенальти ----------
const PENALTY_MULT = [0, 1.45, 2.18, 3.27, 4.91, 7.36];
const DIRS = ['left', 'center', 'right'] as const;
type PenaltyPhase = 'play' | 'done';

interface PenaltySession {
  phase: PenaltyPhase;
  bet: number;
  goals: number;
  history: { dir: string; keeper: string; scored: boolean }[];
  payout?: number;
  result?: 'win' | 'lose' | 'cashout';
}

export class PenaltyGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'penalty', name: 'Пенальти', icon: '⚽', desc: 'Бей в угол — 5 голов подряд, можно забрать после каждого', tag: 'Серия' };
  private sessions = new Map<string, PenaltySession>();

  constructor(private store: Store) {}

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    return { phase: s.phase, goals: s.goals, bet: s.bet, history: s.history, mult: PENALTY_MULT[s.goals], payout: s.payout ?? 0, result: s.result ?? null };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);
    if (action === 'start') {
      if (s && s.phase === 'play') throw new Error('Раунд уже идёт');
      const bet = num(body.bet, 0);
      takeBet(this.store, identity, bet);
      const ns: PenaltySession = { phase: 'play', bet, goals: 0, history: [] };
      this.sessions.set(identity, ns);
      return this.view(identity);
    }
    if (!s || s.phase !== 'play') throw new Error('Нет активного раунда');

    if (action === 'cashout') {
      if (s.goals === 0) throw new Error('Забей хотя бы один гол');
      const payout = Math.floor(s.bet * PENALTY_MULT[s.goals]);
      s.phase = 'done';
      s.payout = payout;
      s.result = 'cashout';
      settle(this.store, identity, 'penalty', s.bet, payout, true);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }

    if (action === 'shoot') {
      const dir = DIRS.includes(body.dir as never) ? (body.dir as string) : 'right';
      const keeper = DIRS[Math.floor(Math.random() * 3)];
      const scored = keeper !== dir;
      s.history.push({ dir, keeper, scored });
      if (!scored) {
        s.phase = 'done';
        s.result = 'lose';
        s.payout = 0;
        settle(this.store, identity, 'penalty', s.bet, 0, false);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      s.goals += 1;
      if (s.goals >= 5) {
        const payout = Math.floor(s.bet * PENALTY_MULT[5]);
        s.phase = 'done';
        s.result = 'win';
        s.payout = payout;
        settle(this.store, identity, 'penalty', s.bet, payout, true);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      this.store.save();
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    throw new Error('Неизвестное действие');
  }
}

// ---------- 🏇 Скачки ----------
export const HORSES = [
  { name: 'Молния', p: 0.3, emoji: '🏇' },
  { name: 'Гроза', p: 0.25, emoji: '🐎' },
  { name: 'Ветер', p: 0.18, emoji: '🐴' },
  { name: 'Тень', p: 0.12, emoji: '🎠' },
  { name: 'Искра', p: 0.09, emoji: '🏇' },
  { name: 'Комета', p: 0.06, emoji: '🐎' },
];
export const HORSE_ODDS = HORSES.map(h => Math.round((0.96 / h.p) * 10) / 10);

interface HorsesState {
  last: { winner: number; win: boolean; payout: number } | null;
}

export class HorsesGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'horses', name: 'Скачки', icon: '🏇', desc: 'Выбери лошадь — коэффициенты от ×3.2 до ×16', tag: 'Гонка' };
  private states = new Map<string, HorsesState>();

  constructor(private store: Store) {}

  view(identity: string) {
    return { horses: HORSES.map((h, i) => ({ ...h, odds: HORSE_ODDS[i] })), last: this.states.get(identity)?.last ?? null };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'race') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    const pick = Math.min(5, Math.max(0, Math.round(num(body.horse, 0))));
    takeBet(this.store, identity, bet);
    let r = Math.random();
    let winner = 5;
    for (let i = 0; i < HORSES.length; i++) {
      r -= HORSES[i].p;
      if (r < 0) {
        winner = i;
        break;
      }
    }
    const win = winner === pick;
    const payout = win ? Math.floor(bet * HORSE_ODDS[pick]) : 0;
    settle(this.store, identity, 'horses', bet, payout, win);
    const last = { winner, win, payout, odds: HORSE_ODDS[pick] };
    this.states.set(identity, { last });
    return { last, balance: this.store.player(identity).balance };
  }
}
