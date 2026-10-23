import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '../../api';
import { useGame } from '../../store';
import { sfx } from '../../sound';
import type { ArcadeMeta, ArcadeState, ArcadeView } from '../../types';

export interface ArcadeApi {
  view: ArcadeView | null;
  balance: number;
  busy: boolean;
  err: string | null;
  act: (action: string, body?: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
  clearErr: () => void;
}

export function useArcade(gameId: string): ArcadeApi {
  const [view, setView] = useState<ArcadeView | null>(null);
  const [balance, setBalance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await apiGet<ArcadeState>(`/arcade/${gameId}/state`);
      if (!mounted.current) return;
      setView(s.view);
      setBalance(s.balance);
      setErr(null);
    } catch (e) {
      if (mounted.current) setErr((e as Error).message);
    }
  }, [gameId]);

  useEffect(() => {
    setView(null);
    setErr(null);
    void refresh();
  }, [refresh]);

  const act = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      if (mounted.current) {
        setBusy(true);
        setErr(null);
      }
      try {
        const r = await apiPost<ArcadeState>(`/arcade/${gameId}`, { action, ...body });
        if (!mounted.current) return;
        setView(r.view);
        setBalance(r.balance);
        void useGame.getState().load();
      } catch (e) {
        if (mounted.current) setErr((e as Error).message);
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [gameId],
  );

  return { view, balance, busy, err, act, refresh, clearErr: () => setErr(null) };
}

export async function fetchArcadeList(): Promise<{ games: ArcadeMeta[]; balance: number }> {
  return apiGet('/arcade');
}

export const BET_PRESETS = [10, 50, 100, 500, 1000];

export function useBet(init = 100) {
  const [bet, setBet] = useState(init);
  const step = (dir: 1 | -1, max: number) => {
    setBet(b => {
      const stepVal = b >= 1000 ? 100 : b >= 100 ? 50 : 10;
      return Math.min(Math.max(b + dir * stepVal, 10), Math.max(10, Math.min(max, 100000)));
    });
  };
  return { bet, setBet, step };
}

export function playSfx(kind: 'win' | 'lose' | 'click' = 'click') {
  if (kind === 'win') sfx.win(false);
  else if (kind === 'lose') sfx.lose();
  else sfx.click();
}
