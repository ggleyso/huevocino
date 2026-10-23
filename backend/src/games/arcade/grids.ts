import type { Store } from '../../store.js';
import { takeBet, settle, num, type ArcadeGame, type ArcadeMeta } from './common.js';

// ---------- 💣 Сапёр ----------
const MINE_SIZE = 5;
const MINE_COUNT = 5;
const MINE_MULT = [0, 1.18, 1.46, 1.85, 2.4, 3.16, 4.3, 6.0, 9.0, 15.0, 27.0];

interface MinesSession {
  bet: number;
  mines: Set<number>;
  opened: Set<number>;
  done: boolean;
  cashed: boolean;
  payout?: number;
}

export class MinesGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'mines', name: 'Сапёр', icon: '💣', desc: 'Открывай клетки, расти множитель, забирай когда хватит', tag: 'Риск' };
  private sessions = new Map<string, MinesSession>();

  constructor(private store: Store) {}

  private pickMines(): Set<number> {
    const s = new Set<number>();
    const total = MINE_SIZE * MINE_SIZE;
    while (s.size < MINE_COUNT) s.add(Math.floor(Math.random() * total));
    return s;
  }

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    const mult = MINE_MULT[Math.min(s.opened.size, MINE_MULT.length - 1)];
    return {
      phase: s.done ? 'done' : 'play',
      bet: s.bet,
      size: MINE_SIZE,
      minesCount: MINE_COUNT,
      opened: [...s.opened],
      exploded: s.done && !s.cashed && s.opened.size >= 0 ? [...s.mines].filter(m => s.opened.has(m)) : [],
      mult: s.opened.size > 0 ? mult : 1,
      cashout: s.done && s.cashed ? s.payout ?? 0 : 0,
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);
    if (action === 'start') {
      if (s && !s.done) throw new Error('Раунд уже идёт');
      const bet = num(body.bet, 0);
      takeBet(this.store, identity, bet);
      this.sessions.set(identity, { bet, mines: this.pickMines(), opened: new Set(), done: false, cashed: false });
      return this.view(identity);
    }
    if (!s || s.done) throw new Error('Нет активного раунда');
    if (action === 'cashout') {
      if (s.opened.size === 0) throw new Error('Открой хотя бы одну клетку');
      const mult = MINE_MULT[Math.min(s.opened.size, MINE_MULT.length - 1)];
      const payout = Math.floor(s.bet * mult);
      s.done = true;
      s.cashed = true;
      settle(this.store, identity, 'mines', s.bet, payout, true);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    if (action === 'open') {
      const cell = Math.round(num(body.cell, -1));
      const total = MINE_SIZE * MINE_SIZE;
      if (cell < 0 || cell >= total) throw new Error('Неверная клетка');
      if (s.opened.has(cell)) throw new Error('Клетка уже открыта');
      s.opened.add(cell);
      if (s.mines.has(cell)) {
        s.done = true;
        settle(this.store, identity, 'mines', s.bet, 0, false);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      if (s.opened.size >= total - MINE_COUNT) {
        const mult = MINE_MULT[MINE_MULT.length - 1];
        const payout = Math.floor(s.bet * mult);
        s.done = true;
        s.cashed = true;
        settle(this.store, identity, 'mines', s.bet, payout, true);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      this.store.save();
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    throw new Error('Неизвестное действие');
  }
}

// ---------- 🪜 Лестница ----------
const LADDER_STEPS = 8;
const LADDER_RISKS = {
  low: { p: 0.9, label: 'Низкий' },
  mid: { p: 0.78, label: 'Средний' },
  high: { p: 0.65, label: 'Высокий' },
} as const;
type LadderRisk = keyof typeof LADDER_RISKS;

interface LadderSession {
  bet: number;
  risk: LadderRisk;
  step: number;
  done: boolean;
  result?: 'cashout' | 'lose' | 'top';
  payout?: number;
}

function ladderMult(risk: LadderRisk, steps: number): number {
  const p = LADDER_RISKS[risk].p;
  return (0.97 / Math.pow(p, steps)) * 0.92;
}

export class LadderGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'ladder', name: 'Лестница', icon: '🪜', desc: 'Поднимайся по ступеням: чем выше, тем больше множитель', tag: 'Риск' };
  private sessions = new Map<string, LadderSession>();

  constructor(private store: Store) {}

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const, risks: this.riskList() };
    return {
      phase: s.done ? 'done' : 'play',
      bet: s.bet,
      risk: s.risk,
      riskLabel: LADDER_RISKS[s.risk].label,
      step: s.step,
      steps: LADDER_STEPS,
      mult: ladderMult(s.risk, Math.max(1, s.step)),
      nextMult: s.step < LADDER_STEPS ? ladderMult(s.risk, s.step + 1) : null,
      result: s.result ?? null,
      payout: s.payout ?? 0,
      risks: this.riskList(),
    };
  }

  private riskList() {
    return (Object.keys(LADDER_RISKS) as LadderRisk[]).map(r => ({
      id: r,
      label: LADDER_RISKS[r].label,
      p: LADDER_RISKS[r].p,
      topMult: Number(ladderMult(r, LADDER_STEPS).toFixed(2)),
    }));
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);
    if (action === 'start') {
      if (s && !s.done) throw new Error('Раунд уже идёт');
      const bet = num(body.bet, 0);
      const risk = (['low', 'mid', 'high'] as string[]).includes(String(body.risk)) ? (body.risk as LadderRisk) : 'mid';
      takeBet(this.store, identity, bet);
      this.sessions.set(identity, { bet, risk, step: 0, done: false });
      return this.view(identity);
    }
    if (!s || s.done) throw new Error('Нет активного раунда');
    if (action === 'cashout') {
      if (s.step === 0) throw new Error('Сделай хотя бы один шаг');
      const payout = Math.floor(s.bet * ladderMult(s.risk, s.step));
      s.done = true;
      s.result = 'cashout';
      s.payout = payout;
      settle(this.store, identity, 'ladder', s.bet, payout, true);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    if (action === 'step') {
      const p = LADDER_RISKS[s.risk].p;
      if (Math.random() > p) {
        s.done = true;
        s.result = 'lose';
        s.payout = 0;
        settle(this.store, identity, 'ladder', s.bet, 0, false);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      s.step += 1;
      if (s.step >= LADDER_STEPS) {
        const payout = Math.floor(s.bet * ladderMult(s.risk, LADDER_STEPS));
        s.done = true;
        s.result = 'top';
        s.payout = payout;
        settle(this.store, identity, 'ladder', s.bet, payout, true);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      this.store.save();
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    throw new Error('Неизвестное действие');
  }
}

// ---------- 🐔 Цыплёнок ----------
const ROAD_LANES = 6;
const CHICKEN_RISKS = [
  { id: 0, label: 'Тихая', p: 0.94 },
  { id: 1, label: 'Средняя', p: 0.86 },
  { id: 2, label: 'Жаркая', p: 0.78 },
];

interface ChickenSession {
  bet: number;
  risk: number;
  lane: number;
  done: boolean;
  result?: 'cashout' | 'lose' | 'end';
  payout?: number;
}

function chickenMult(riskIdx: number, lanes: number): number {
  const p = CHICKEN_RISKS[riskIdx].p;
  return Number(((0.96 / Math.pow(p, lanes)) * 0.94).toFixed(2));
}

export class ChickenGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'chicken', name: 'Цыплёнок', icon: '🐔', desc: 'Перебеги дорогу: каждая полоса — множитель, но машина рядом', tag: 'Риск' };
  private sessions = new Map<string, ChickenSession>();

  constructor(private store: Store) {}

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const, risks: CHICKEN_RISKS, lanes: ROAD_LANES };
    return {
      phase: s.done ? 'done' : 'play',
      bet: s.bet,
      risk: s.risk,
      lane: s.lane,
      lanes: ROAD_LANES,
      mult: chickenMult(s.risk, Math.max(1, s.lane)),
      nextMult: s.lane < ROAD_LANES ? chickenMult(s.risk, s.lane + 1) : null,
      result: s.result ?? null,
      payout: s.payout ?? 0,
      risks: CHICKEN_RISKS,
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);
    if (action === 'start') {
      if (s && !s.done) throw new Error('Раунд уже идёт');
      const bet = num(body.bet, 0);
      const risk = Math.min(2, Math.max(0, Math.round(num(body.risk, 1))));
      takeBet(this.store, identity, bet);
      this.sessions.set(identity, { bet, risk, lane: 0, done: false });
      return this.view(identity);
    }
    if (!s || s.done) throw new Error('Нет активного раунда');
    if (action === 'cashout') {
      if (s.lane === 0) throw new Error('Перебеги хотя бы одну полосу');
      const payout = Math.floor(s.bet * chickenMult(s.risk, s.lane));
      s.done = true;
      s.result = 'cashout';
      s.payout = payout;
      settle(this.store, identity, 'chicken', s.bet, payout, true);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    if (action === 'cross') {
      const p = CHICKEN_RISKS[s.risk].p;
      if (Math.random() > p) {
        s.done = true;
        s.result = 'lose';
        s.payout = 0;
        settle(this.store, identity, 'chicken', s.bet, 0, false);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      s.lane += 1;
      if (s.lane >= ROAD_LANES) {
        const payout = Math.floor(s.bet * chickenMult(s.risk, ROAD_LANES));
        s.done = true;
        s.result = 'end';
        s.payout = payout;
        settle(this.store, identity, 'chicken', s.bet, payout, true);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      this.store.save();
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    throw new Error('Неизвестное действие');
  }
}

// ---------- 🌟 Кено ----------
const KENO_POOL = 12;
const KENO_PICK = 5;
const KENO_DRAW = 5;
const KENO_PAY: Record<number, number> = { 3: 3, 4: 20, 5: 150 };

interface KenoState {
  last: { picked: number[]; drawn: number[]; hits: number; payout: number } | null;
}

export class KenoGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'keno', name: 'Кено', icon: '🌟', desc: 'Выбери 5 из 12 — совпадения платят до ×150', tag: 'Лотерея' };
  private states = new Map<string, KenoState>();

  constructor(private store: Store) {}

  view(identity: string) {
    return { pool: KENO_POOL, pick: KENO_PICK, draw: KENO_DRAW, pay: KENO_PAY, last: this.states.get(identity)?.last ?? null };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'draw') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    const raw = Array.isArray(body.picked) ? (body.picked as unknown[]).map(v => Math.round(num(v, -1))) : [];
    const picked = [...new Set(raw)].filter(v => v >= 0 && v < KENO_POOL);
    if (picked.length !== KENO_PICK) throw new Error(`Выбери ровно ${KENO_PICK} числа`);
    takeBet(this.store, identity, bet);
    const pool = Array.from({ length: KENO_POOL }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const drawn = pool.slice(0, KENO_DRAW);
    const hits = picked.filter(p => drawn.includes(p)).length;
    const mult = KENO_PAY[hits] ?? 0;
    const payout = Math.floor(bet * mult);
    settle(this.store, identity, 'keno', bet, payout, payout > 0);
    const last = { picked, drawn, hits, payout, mult };
    this.states.set(identity, { last });
    return { last, balance: this.store.player(identity).balance };
  }
}

// ---------- ⭕ Крестики-нолики ----------
type Cell = 'X' | 'O' | null;
const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function tttWinner(b: Cell[]): { who: 'X' | 'O' } | null {
  for (const [a, c, d] of TTT_LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a] };
  }
  return null;
}

function tttBestMove(board: Cell[], me: 'X' | 'O'): number | null {
  const empty = board.map((c, i) => (c === null ? i : -1)).filter(i => i >= 0);
  if (empty.length === 0) return null;
  // лёгкий ИИ: выиграть / заблокировать / центр / случайная
  const tryWin = (who: 'X' | 'O') => {
    for (const i of empty) {
      const copy = [...board];
      copy[i] = who;
      if (tttWinner(copy)?.who === who) return i;
    }
    return null;
  };
  const win = tryWin(me);
  if (win !== null) return win;
  const block = tryWin(me === 'X' ? 'O' : 'X');
  if (block !== null) return block;
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter(i => board[i] === null);
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
  return empty[Math.floor(Math.random() * empty.length)];
}

interface TTTSession {
  bet: number;
  board: Cell[];
  phase: 'play' | 'done';
  result?: 'win' | 'lose' | 'draw';
  payout?: number;
}

export class TicTacToeGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'tictactoe', name: 'Крестики-нолики', icon: '⭕', desc: 'Победи ИИ — победа ×1.9, ничья возврат ставки', tag: 'ИИ' };
  private sessions = new Map<string, TTTSession>();

  constructor(private store: Store) {}

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    const win = tttWinner(s.board);
    return {
      phase: s.phase,
      bet: s.bet,
      board: s.board,
      winLine: win ? TTT_LINES.find(([a, c, d]) => s.board[a] && s.board[a] === s.board[c] && s.board[a] === s.board[d]) ?? null : null,
      result: s.result ?? null,
      payout: s.payout ?? 0,
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);
    if (action === 'start') {
      if (s && s.phase === 'play') throw new Error('Партия уже идёт');
      const bet = num(body.bet, 0);
      takeBet(this.store, identity, bet);
      this.sessions.set(identity, { bet, board: Array(9).fill(null) as Cell[], phase: 'play' });
      return this.view(identity);
    }
    if (!s || s.phase !== 'play') throw new Error('Нет активной партии');
    if (action === 'move') {
      const idx = Math.round(num(body.cell, -1));
      if (idx < 0 || idx > 8 || s.board[idx] !== null) throw new Error('Клетка занята');
      s.board[idx] = 'X';
      let win = tttWinner(s.board);
      if (!win && s.board.some(c => c === null)) {
        const ai = tttBestMove(s.board, 'O');
        if (ai !== null) s.board[ai] = 'O';
        win = tttWinner(s.board);
      }
      const full = s.board.every(c => c !== null);
      if (win || full) {
        s.phase = 'done';
        if (win?.who === 'X') {
          s.result = 'win';
          s.payout = Math.floor(s.bet * 1.9);
        } else if (win?.who === 'O') {
          s.result = 'lose';
          s.payout = 0;
        } else {
          s.result = 'draw';
          s.payout = s.bet;
        }
        settle(this.store, identity, 'tictactoe', s.bet, s.payout, s.result === 'win');
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      this.store.save();
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    if (action === 'surrender') {
      s.phase = 'done';
      s.result = 'lose';
      s.payout = 0;
      settle(this.store, identity, 'tictactoe', s.bet, 0, false);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    throw new Error('Неизвестное действие');
  }
}
