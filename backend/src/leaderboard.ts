import type { Store } from './store.js';

export interface LeaderboardRow {
  rank: number;
  name: string;
  balance: number;
  best: number;
  wins: number;
  rounds: number;
  demo: boolean;
  self: boolean;
}

export function leaderboard(store: Store, selfIdentity: string, limit = 20): { rows: LeaderboardRow[]; selfRank: number; total: number } {
  const all = Object.entries(store.data.players).map(([identity, p]) => ({
    identity,
    name: p.name,
    balance: p.balance,
    best: p.stats?.best ?? 0,
    wins: (p.stats?.wins ?? 0) + Object.values(p.gameStats ?? {}).reduce((a, g) => a + (g.wins ?? 0), 0),
    rounds: (p.stats?.rounds ?? 0) + Object.values(p.gameStats ?? {}).reduce((a, g) => a + (g.rounds ?? g.spins ?? 0), 0),
    demo: Boolean(p.demo),
  }));

  all.sort((a, b) => b.balance - a.balance || b.wins - a.wins);

  const selfIdx = all.findIndex(r => r.identity === selfIdentity);
  const rows = all.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1, self: r.identity === selfIdentity }));
  return {
    rows: rows.map(({ identity, ...rest }) => {
      void identity;
      return rest;
    }),
    selfRank: selfIdx >= 0 ? selfIdx + 1 : 0,
    total: all.length,
  };
}
