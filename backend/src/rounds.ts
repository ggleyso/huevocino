import crypto from 'node:crypto';
import type { Store } from './store.js';
import { rollCrash, multiplierAt, crashTimeMs, payoutFor, MIN_BET, MAX_BET } from './engine.js';

export interface Round {
  id: string;
  identity: string;
  bet: number;
  startTs: number;
  crashAt: number;
  crashTs: number;
  cashedOut: boolean;
  cashoutTs: number | null;
  cashoutAt: number | null;
  payout: number;
  resolved: boolean;
}

export interface CrashEvent {
  event: 'crash';
  crashAt: number;
  crashTs: number;
}

type Listener = (e: CrashEvent) => void;

export class RoundError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class RoundManager {
  private rounds = new Map<string, Round>();
  private byPlayer = new Map<string, string>();
  private listeners = new Map<string, Set<Listener>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private now: () => number;
  private schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private cancel: (t: ReturnType<typeof setTimeout>) => void;

  constructor(
    private store: Store,
    opts?: {
      now?: () => number;
      schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
      cancel?: (t: ReturnType<typeof setTimeout>) => void;
      rng?: () => number;
    },
  ) {
    this.now = opts?.now ?? Date.now;
    this.schedule = opts?.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancel = opts?.cancel ?? (t => clearTimeout(t));
    this.rng = opts?.rng ?? rollCrash;
  }

  private rng: (r?: number) => number;

  start(identity: string, bet: number): Round {
    const existingId = this.byPlayer.get(identity);
    if (existingId) {
      const existing = this.rounds.get(existingId);
      if (existing && !existing.resolved) throw new RoundError(409, 'Раунд ещё идёт');
    }
    const player = this.store.player(identity);
    const err = this.store.validateBet(player.balance, bet);
    if (err) throw new RoundError(400, err);

    player.balance -= bet;
    const startTs = this.now();
    const crashAt = this.rng();
    const round: Round = {
      id: crypto.randomUUID(),
      identity,
      bet,
      startTs,
      crashAt,
      crashTs: startTs + crashTimeMs(crashAt),
      cashedOut: false,
      cashoutTs: null,
      cashoutAt: null,
      payout: 0,
      resolved: false,
    };
    this.rounds.set(round.id, round);
    this.byPlayer.set(identity, round.id);
    this.store.save();

    const timer = this.schedule(() => this.fireCrash(round.id), Math.max(0, round.crashTs - this.now()));
    this.timers.set(round.id, timer);
    return round;
  }

  cashout(id: string, identity: string): { round: Round; multiplier: number; payout: number } {
    const round = this.rounds.get(id);
    if (!round || round.identity !== identity) throw new RoundError(404, 'Раунд не найден');
    if (round.resolved || round.cashedOut) throw new RoundError(409, 'Раунд уже завершён');

    const nowTs = this.now();
    if (nowTs >= round.crashTs) {
      this.fireCrash(round.id);
      throw new RoundError(409, 'Самолётик уже разбился');
    }

    const multiplier = multiplierAt(nowTs - round.startTs);
    const payout = payoutFor(round.bet, multiplier);
    const player = this.store.player(identity);
    player.balance += payout;
    player.history.unshift({
      id: round.id,
      bet: round.bet,
      crashAt: null,
      cashoutAt: Math.floor(multiplier * 100) / 100,
      payout,
      win: true,
      ts: nowTs,
    });
    player.history = player.history.slice(0, 50);
    player.stats.rounds += 1;
    player.stats.wins += 1;
    player.stats.stake += round.bet;
    player.stats.returned += payout;
    player.stats.best = Math.max(player.stats.best, Math.floor(multiplier * 100) / 100);

    round.cashedOut = true;
    round.cashoutTs = nowTs;
    round.cashoutAt = Math.floor(multiplier * 100) / 100;
    round.payout = payout;
    this.store.save();
    return { round, multiplier: Math.floor(multiplier * 100) / 100, payout };
  }

  fireCrash(id: string): Round | null {
    const round = this.rounds.get(id);
    if (!round || round.resolved) return round ?? null;
    const player = this.store.player(round.identity);
    round.resolved = true;
    if (!round.cashedOut) {
      player.history.unshift({
        id: round.id,
        bet: round.bet,
        crashAt: round.crashAt,
        cashoutAt: null,
        payout: 0,
        win: false,
        ts: this.now(),
      });
      player.history = player.history.slice(0, 50);
      player.stats.rounds += 1;
      player.stats.losses += 1;
      player.stats.stake += round.bet;
    } else {
      const entry = player.history.find(h => h.id === round.id);
      if (entry) entry.crashAt = round.crashAt;
    }
    this.store.save();
    this.emit(round.id, { event: 'crash', crashAt: round.crashAt, crashTs: round.crashTs });
    this.cleanup(round);
    return round;
  }

  getActive(identity: string): Round | null {
    const id = this.byPlayer.get(identity);
    if (!id) return null;
    const round = this.rounds.get(id);
    if (!round || round.resolved) return null;
    return round;
  }

  get(id: string): Round | null {
    return this.rounds.get(id) ?? null;
  }

  subscribe(id: string, fn: Listener): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.listeners.delete(id);
    };
  }

  private emit(id: string, e: CrashEvent) {
    const set = this.listeners.get(id);
    if (!set) return;
    for (const fn of [...set]) fn(e);
  }

  private cleanup(round: Round) {
    const t = this.timers.get(round.id);
    if (t) {
      this.cancel(t);
      this.timers.delete(round.id);
    }
    setTimeout(() => {
      this.rounds.delete(round.id);
      if (this.byPlayer.get(round.identity) === round.id) this.byPlayer.delete(round.identity);
    }, 60_000).unref?.();
    const set = this.listeners.get(round.id);
    if (set && set.size === 0) this.listeners.delete(round.id);
  }
}
