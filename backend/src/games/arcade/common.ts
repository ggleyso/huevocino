import type { Store, Player } from '../../store.js';

export interface ArcadeMeta {
  id: string;
  name: string;
  icon: string;
  desc: string;
  tag: string;
}

export interface ArcadeGame {
  meta: ArcadeMeta;
  view(identity: string): unknown;
  act(identity: string, action: string, body: Record<string, unknown>): unknown;
}

export function takeBet(store: Store, identity: string, bet: number): Player {
  const p = store.player(identity);
  const err = store.validateBet(p.balance, bet);
  if (err) throw new Error(err);
  p.balance -= bet;
  store.save();
  return p;
}

export function settle(store: Store, identity: string, gameId: string, bet: number, payout: number, win: boolean): Player {
  const p = store.player(identity);
  p.balance += payout;
  p.gameStats[gameId] ??= { rounds: 0, wins: 0, wagered: 0, won: 0 };
  const g = p.gameStats[gameId];
  g.rounds = (g.rounds ?? 0) + 1;
  g.wagered = (g.wagered ?? 0) + bet;
  g.won = (g.won ?? 0) + payout;
  if (win) g.wins = (g.wins ?? 0) + 1;
  store.save();
  return p;
}

export function num(v: unknown, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
