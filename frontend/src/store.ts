import { create } from 'zustand';
import { apiGet, apiPost, deviceId } from './api';
import { sfx } from './sound';

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
  ts: number;
}

export interface RoundSummary {
  id: string;
  bet: number;
  startTs: number;
  cashedOut?: boolean;
  cashoutAt?: number | null;
  payout?: number;
}

export interface StateData {
  identity: string;
  name?: string;
  balance: number;
  history: HistoryItem[];
  topups: TopupItem[];
  stats: { rounds: number; wins: number; losses: number; stake: number; returned: number; best: number };
  commission: { percent: number; enabled: boolean };
  treasury: number;
  bonus?: { ready: boolean; nextTs: number };
  activeRound: RoundSummary | null;
  limits: { minBet: number; maxBet: number };
}

type Phase = 'idle' | 'flying' | 'ended';

interface GameStore {
  loaded: boolean;
  data: StateData | null;
  phase: Phase;
  round: RoundSummary | null;
  mult: number;
  crashAt: number | null;
  cashedOut: boolean;
  result: { win: boolean; multiplier: number | null; payout: number; crashAt: number | null } | null;
  bet: number;
  autoCashout: number;
  error: string | null;
  walletOpen: boolean;
  load: () => Promise<void>;
  setBet: (n: number) => void;
  setAutoCashout: (n: number) => void;
  start: () => Promise<void>;
  cashout: () => Promise<void>;
  setMult: (m: number) => void;
  setError: (e: string | null) => void;
  setWallet: (open: boolean) => void;
}

export const useGame = create<GameStore>((set, get) => ({
  loaded: false,
  data: null,
  phase: 'idle',
  round: null,
  mult: 1,
  crashAt: null,
  cashedOut: false,
  result: null,
  bet: 100,
  autoCashout: 0,
  error: null,
  walletOpen: false,

  load: async () => {
    try {
      const data = await apiGet<StateData>('/state');
      const s = get();
      set({
        data,
        loaded: true,
        error: null,
        bet: Math.min(Math.max(s.bet, data.limits.minBet), data.balance >= data.limits.minBet ? data.balance : data.limits.minBet),
        ...(data.activeRound
          ? {
              phase: 'flying' as Phase,
              round: data.activeRound,
              mult: 1,
              crashAt: null,
              cashedOut: Boolean(data.activeRound.cashedOut),
              result: data.activeRound.cashedOut
                ? { win: true, multiplier: data.activeRound.cashoutAt ?? null, payout: data.activeRound.payout ?? 0, crashAt: null }
                : null,
            }
          : s.phase === 'flying'
            ? { phase: 'idle' as Phase, round: null, cashedOut: false }
            : {}),
      });
      if (data.activeRound) void streamLoop(data.activeRound.id, set, get);
    } catch (e) {
      set({ error: (e as Error).message, loaded: true });
    }
  },

  setBet: n => set({ bet: n }),

  setAutoCashout: n => set({ autoCashout: n }),

  start: async () => {
    const { data, phase } = get();
    if (!data || phase === 'flying') return;
    try {
      const round = await apiPost<RoundSummary>('/round/start', { bet: get().bet });
      set({ phase: 'flying', round, mult: 1, crashAt: null, cashedOut: false, result: null, error: null });
      void streamLoop(round.id, set, get);
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  cashout: async () => {
    const { round, phase } = get();
    if (!round || phase !== 'flying') return;
    try {
      const r = await apiPost<{ multiplier: number; payout: number; balance: number }>('/round/cashout', { id: round.id });
      set(s => ({
        cashedOut: true,
        result: { win: true, multiplier: r.multiplier, payout: r.payout, crashAt: null },
        data: s.data ? { ...s.data, balance: r.balance } : s.data,
        error: null,
      }));
      void get().load();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  setMult: m => {
    const s = get();
    set({ mult: m });
    if (s.autoCashout > 0 && s.phase === 'flying' && !s.cashedOut && m >= s.autoCashout) {
      set({ autoCashout: 0 });
      sfx.cashout();
      void get().cashout();
    }
  },
  setError: e => set({ error: e }),
  setWallet: open => set({ walletOpen: open }),
}));

async function streamLoop(
  roundId: string,
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
) {
  try {
    const h: Record<string, string> = {};
    const session = localStorage.getItem('vzlet_session');
    if (session) h['x-session'] = JSON.parse(session).token;
    else h['x-device-id'] = deviceId();

    const resp = await fetch(`/api/round/${roundId}/stream`, { headers: h });
    if (!resp.ok || !resp.body) throw new Error('stream failed');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;
        const ev = JSON.parse(line.slice(6));
        if (ev.event === 'crash') handleCrash(ev.crashAt as number, set, get);
      }
    }
  } catch {
    // стрим оборвался — финальное состояние подтянем через load()
    await get().load();
    const s = get();
    if (s.round && s.round.id === roundId && s.phase === 'flying' && !s.data?.activeRound) {
      finishFromHistory(roundId, set, get);
    }
  }
}

function handleCrash(crashAt: number, set: (partial: Partial<GameStore>) => void, get: () => GameStore) {
  const s = get();
  if (s.round?.id) {
    const already = s.result;
    set({
      phase: 'ended',
      crashAt,
      result: already
        ? { ...already, crashAt }
        : { win: false, multiplier: null, payout: 0, crashAt },
    });
    void get().load();
  }
}

function finishFromHistory(roundId: string, set: (partial: Partial<GameStore>) => void, get: () => GameStore) {
  const s = get();
  const item = s.data?.history.find(h => h.id === roundId);
  if (!item) return;
  set({
    phase: 'ended',
    crashAt: item.crashAt,
    result: { win: item.win, multiplier: item.cashoutAt, payout: item.payout, crashAt: item.crashAt },
    round: null,
  });
}
