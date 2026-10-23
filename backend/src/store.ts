import fs from 'node:fs';
import path from 'node:path';
import { START_BALANCE, MIN_BET, MAX_BET } from './engine.js';

export interface HistoryItem {
  id: string;
  bet: number;
  crashAt: number | null;
  cashoutAt: number | null;
  payout: number;
  win: boolean;
  ts: number;
}

export interface TopupItem {
  amount: number;
  net: number;
  fee: number;
  test: boolean;
  intentId?: string;
  ts: number;
}

export interface GameStats {
  rounds?: number;
  wins?: number;
  wagered?: number;
  won?: number;
  spins?: number;
}

export interface Player {
  balance: number;
  name: string;
  demo?: boolean;
  history: HistoryItem[];
  topups: TopupItem[];
  stats: { rounds: number; wins: number; losses: number; stake: number; returned: number; best: number };
  gameStats: Record<string, GameStats>;
  idem?: { key: string; net: number; fee: number };
  lastBonus?: number;
}

export const BONUS_AMOUNT = 500;
export const BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function validateName(name: string): string | null {
  const n = name.trim();
  if (n.length < 3) return 'Имя от 3 символов';
  if (n.length > 16) return 'Имя до 16 символов';
  if (!/^[A-Za-zА-Яа-яЁё0-9 _-]+$/.test(n)) return 'Только буквы, цифры, пробел, дефис и подчёркивание';
  return null;
}

interface DB {
  players: Record<string, Player>;
  settings: { commissionPercent: number; commissionEnabled: boolean };
  treasury: number;
}

const DEFAULT_DB: DB = {
  players: {},
  settings: { commissionPercent: 5, commissionEnabled: true },
  treasury: 0,
};

function emptyPlayer(name?: string): Player {
  return {
    balance: START_BALANCE,
    name: name ?? `Пилот-${Math.floor(1000 + Math.random() * 9000)}`,
    history: [],
    topups: [],
    stats: { rounds: 0, wins: 0, losses: 0, stake: 0, returned: 0, best: 0 },
    gameStats: {},
    lastBonus: 0,
  };
}

const DEMO_PLAYERS: { id: string; name: string; balance: number; best: number }[] = [
  { id: 'demo:ace', name: 'Туз', balance: 48200, best: 41.2 },
  { id: 'demo:lucky', name: 'Фортуна', balance: 31750, best: 28.4 },
  { id: 'demo:risk', name: 'Риск', balance: 19400, best: 17.9 },
  { id: 'demo:calm', name: 'Спокойствие', balance: 15300, best: 9.4 },
  { id: 'demo:chance', name: 'Шанс', balance: 11250, best: 12.1 },
  { id: 'demo:nova', name: 'Нова', balance: 8600, best: 7.7 },
  { id: 'demo:vet', name: 'Хвост', balance: 6100, best: 5.3 },
  { id: 'demo:bee', name: 'Пчёлка', balance: 4300, best: 6.6 },
  { id: 'demo:new', name: 'Новичок', balance: 1150, best: 2.2 },
];

export class Store {
  data: DB;
  private file: string | null;

  constructor(filePath?: string) {
    this.file = filePath ?? null;
    this.data = { ...DEFAULT_DB, players: {}, settings: { ...DEFAULT_DB.settings }, treasury: 0 };
    if (this.file && fs.existsSync(this.file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as DB;
        this.data = { ...DEFAULT_DB, ...parsed, settings: { ...DEFAULT_DB.settings, ...parsed.settings } };
        for (const [id, raw] of Object.entries(this.data.players)) {
          const p = raw as Partial<Player>;
          p.balance ??= 0;
          p.history ??= [];
          p.topups ??= [];
          p.gameStats ??= {};
          p.stats ??= { rounds: 0, wins: 0, losses: 0, stake: 0, returned: 0, best: 0 };
          p.lastBonus ??= 0;
          p.name ??= id.startsWith('device:') ? `Пилот-${id.slice(-4).toUpperCase()}` : `Игрок-${id.slice(-6)}`;
        }
      } catch {
        this.data = { ...DEFAULT_DB, players: {}, settings: { ...DEFAULT_DB.settings }, treasury: 0 };
      }
    }
  }

  player(identity: string): Player {
    if (!this.data.players[identity]) {
      const p = emptyPlayer();
      if (identity.startsWith('device:')) p.name = `Пилот-${identity.slice(-4).toUpperCase()}`;
      this.data.players[identity] = p;
      this.save();
    }
    return this.data.players[identity];
  }

  seedDemoPlayers() {
    let added = false;
    for (const d of DEMO_PLAYERS) {
      const id = `demo:${d.id.replace('demo:', '')}`;
      if (!this.data.players[id]) {
        this.data.players[id] = {
          ...emptyPlayer(d.name),
          balance: d.balance,
          demo: true,
          stats: { rounds: 40, wins: 18, losses: 22, stake: 9000, returned: 9500, best: d.best },
        };
        added = true;
      }
    }
    if (added) this.save();
  }

  commission(): { percent: number; enabled: boolean } {
    return { percent: this.data.settings.commissionPercent, enabled: this.data.settings.commissionEnabled };
  }

  setCommission(percent: number, enabled: boolean) {
    this.data.settings.commissionPercent = percent;
    this.data.settings.commissionEnabled = enabled;
    this.save();
  }

  validateBet(balance: number, bet: number): string | null {
    if (!Number.isInteger(bet)) return 'Ставка — целое число';
    if (bet < MIN_BET) return `Минимальная ставка ${MIN_BET}`;
    if (bet > MAX_BET) return `Максимальная ставка ${MAX_BET}`;
    if (bet > balance) return 'Недостаточно монет';
    return null;
  }

  bonusState(identity: string, now = Date.now()): { ready: boolean; nextTs: number } {
    const last = this.player(identity).lastBonus ?? 0;
    const nextTs = last > 0 ? last + BONUS_COOLDOWN_MS : 0;
    return { ready: now >= nextTs, nextTs };
  }

  claimBonus(identity: string, now = Date.now()): { ok: boolean; nextTs: number; balance: number } {
    const p = this.player(identity);
    const last = p.lastBonus ?? 0;
    const nextTs = last > 0 ? last + BONUS_COOLDOWN_MS : 0;
    if (nextTs > 0 && now < nextTs) return { ok: false, nextTs, balance: p.balance };
    p.lastBonus = now;
    p.balance += BONUS_AMOUNT;
    this.save();
    return { ok: true, nextTs: now + BONUS_COOLDOWN_MS, balance: p.balance };
  }

  save() {
    if (!this.file) return;
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }
}
