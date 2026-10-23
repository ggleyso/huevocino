import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, fmt } from '../api';
import { useGame } from '../store';
import { PlayingCard } from '../components/PlayingCard';
import { Confetti } from '../components/Confetti';
import { sfx } from '../sound';
import type { BlackjackView } from '../types';

const BET_PRESETS = [10, 50, 100, 500, 1000];

const RESULT_TEXT: Record<string, string> = {
  blackjack: 'БЛЭКДЖЕК! 3:2',
  win: 'ПОБЕДА',
  push: 'НИЧЬЯ',
  lose: 'ПРОИГРЫШ',
};

const SEAT_STATUS: Record<string, { text: string; cls: string }> = {
  blackjack: { text: 'БЛЭКДЖЕК', cls: 'gold' },
  win: { text: 'ПОБЕДА', cls: 'gold' },
  push: { text: 'НИЧЬЯ', cls: 'grey' },
  lose: { text: 'ПРОИГРЫШ', cls: 'red' },
};

interface SeatRow {
  name: string;
  me: boolean;
  joinedAt: number;
  hand: BlackjackView | null;
}

const JOIN_COUNTDOWN_S = 15;

export function BlackjackPage() {
  const [view, setView] = useState<BlackjackView | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [cap, setCap] = useState(4);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(100);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);

  const apply = useCallback((payload: { view?: BlackjackView; active?: BlackjackView | null; balance?: number; seats?: SeatRow[]; cap?: number }) => {
    if (payload.view !== undefined) setView(payload.view);
    else if (payload.active !== undefined && payload.active) setView(payload.active);
    if (typeof payload.balance === 'number') setBalance(payload.balance);
    if (payload.seats) setSeats(payload.seats);
    if (payload.cap) setCap(payload.cap);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await apiGet<{ active: BlackjackView | null; balance: number; seats: SeatRow[]; cap: number }>('/blackjack/state');
      if (!busyRef.current) apply(s);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 1500);
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [refresh]);

  // при посадке за стол стартует отсчёт 15 сек (играть можно сразу)
  useEffect(() => {
    void sitDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // звуки по переходам состояния
  const prevState = useRef<BlackjackView['state'] | null>(null);
  const [conf, setConf] = useState(0);
  useEffect(() => {
    const st: BlackjackView['state'] | null = view?.state ?? null;
    const prev = prevState.current;
    prevState.current = st;
    if (st === prev) return;
    if (st === 'playing') sfx.deal();
    else if (st === 'dealer') sfx.flip();
    else if (st === 'done' && view?.result) {
      if (view.result === 'blackjack') {
        sfx.winCards();
        setConf(c => c + 1);
      } else if (view.result === 'win') sfx.winCards();
      else if (view.result === 'push') sfx.push();
      else sfx.loseCards();
    }
  }, [view?.state, view?.result]);

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    busyRef.current = true;
    try {
      const r = await apiPost<{ view: BlackjackView; balance: number; seats: SeatRow[] }>(path, body);
      apply(r);
      setErr(null);
      void useGame.getState().load();
    } catch (e) {
      setErr((e as Error).message);
    }
    busyRef.current = false;
    setBusy(false);
  };

  const sitDown = async () => {
    setBusy(true);
    busyRef.current = true;
    try {
      const r = await apiPost<{ ok: boolean; seats: SeatRow[]; cap: number }>('/blackjack/join');
      apply(r);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
    busyRef.current = false;
    setBusy(false);
  };

  const standUp = async () => {
    setBusy(true);
    busyRef.current = true;
    try {
      const r = await apiPost<{ ok: boolean; seats: SeatRow[]; cap: number }>('/blackjack/leave');
      apply(r);
      setView(v => (v && v.state !== 'done' ? v : null));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
    busyRef.current = false;
    setBusy(false);
  };

  const me = seats.find(s => s.me);
  const myTurn = !!view && view.state === 'playing';
  const canBet = bet >= 10 && bet <= balance;
  const dealerDone = view?.state === 'done';
  const mult = view?.result === 'blackjack' ? '3:2' : view?.result === 'win' ? '1:1' : '';
  const idle = !view || view.state === 'done';
  const countdown = me && idle ? Math.max(0, Math.ceil((me.joinedAt + JOIN_COUNTDOWN_S * 1000 - now) / 1000)) : 0;
  const broke = balance < 10;

  const empties = Math.max(0, cap - seats.length);

  return (
    <div className="game-page" style={{ position: 'relative' }}>
      <Confetti show={conf} />
      <div className="page-head">
        <h2>🃏 Блэкджек 21</h2>
        <span className="balance-pill">
          🪙 {fmt(balance)} <i className="seats-counter">за столом {seats.length}/{cap}</i>
        </span>
      </div>

      {err && (
        <div className="err-banner" onClick={() => setErr(null)}>
          {err}
        </div>
      )}

      <div className="felt">
        <div className="felt-row">
          <span className="felt-label">Дилер (бот) {view?.dealerTotal != null && dealerDone ? `· ${view.dealerTotal}` : ''}</span>
          <div className="cards-line">
            {view ? (
              view.dealer.map((c, i) => <PlayingCard key={i} card={c} hidden={!dealerDone && i === 1} />)
            ) : (
              <span className="muted-text">Дилер ждёт первую ставку</span>
            )}
          </div>
        </div>

        {view && view.result && dealerDone && (
          <div className={`result-banner result-${view.result}`}>
            {RESULT_TEXT[view.result]} {view.result !== 'lose' && view.payout > 0 ? `+${fmt(view.payout)} 🪙` : view.result === 'lose' ? `−${fmt(view.bet)} 🪙` : ''}
            {mult && <span className="result-mult"> ({mult})</span>}
          </div>
        )}

        <div className="felt-row">
          <span className="felt-label">Вы {view ? `· ${view.playerTotal}` : ''}</span>
          <div className="cards-line">
            {view ? view.player.map((c, i) => <PlayingCard key={i} card={c} />) : <span className="muted-text">Сделай ставку и нажми «Раздать»</span>}
          </div>
        </div>
      </div>

      <div className="seats-block panel">
        <div className="flex items-center justify-between mb-2">
          <b style={{ fontSize: 13.5 }}>Игроки за столом</b>
          <div className="flex gap-2">
            {!me && (
              <button className="btn-ghost" disabled={busy} onClick={sitDown}>
                🪑 Сесть
              </button>
            )}
            {me && !idle && (
              <button className="btn-ghost" disabled={busy} onClick={standUp}>
                Встать
              </button>
            )}
          </div>
        </div>
        <div className="seats-row">
          {seats.map((s, i) => (
            <div key={`${s.name}-${i}`} className={`seat${s.me ? ' me' : ''}`}>
              <div className="seat-name">
                {s.name}
                {s.me && <span className="self-badge">вы</span>}
              </div>
              {s.hand ? (
                <>
                  <div className="seat-cards">
                    {s.hand.player.map((c, j) => (
                      <PlayingCard key={j} card={c} small />
                    ))}
                  </div>
                  <div className="seat-meta">
                    <span className="seat-total">{s.hand.playerTotal}</span>
                    <span className="seat-bet">🪙 {fmt(s.hand.bet)}</span>
                  </div>
                  <span className={`seat-status ${s.hand.state === 'done' ? (SEAT_STATUS[s.hand.result ?? '']?.cls ?? '') : 'play'}`}>
                    {s.hand.state === 'done' ? (SEAT_STATUS[s.hand.result ?? '']?.text ?? 'ГОТОВО') : 'ход…'}
                  </span>
                </>
              ) : (
                <span className="seat-idle">жду ставку…</span>
              )}
            </div>
          ))}
          {Array.from({ length: empties }).map((_, i) => (
            <div key={`e${i}`} className="seat empty">
              <span>Свободно</span>
            </div>
          ))}
        </div>
      </div>

      <div className="controls panel">
        {countdown > 0 && (
          <div className="join-countdown">
            🪑 Стол набирает игроков: <b>{countdown}</b>с — можно играть сразу, каждый сам против бота
          </div>
        )}
        {myTurn ? (
          <div className="action-row">
            <button className="btn-primary" disabled={busy || !view?.canHit} onClick={() => act('/blackjack/hit')} style={{ flex: 1 }}>
              Ещё
            </button>
            <button className="btn-ghost" disabled={busy || !view?.canStand} onClick={() => act('/blackjack/stand')} style={{ flex: 1, padding: 14 }}>
              Стенд
            </button>
            <button className="btn-cashout" disabled={busy || !view?.canDouble} onClick={() => act('/blackjack/double')} style={{ flex: 1, animation: 'none', padding: 14 }}>
              Дабл ×2
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-2 flex-wrap items-center">
              <b style={{ fontSize: 14 }}>Ставка</b>
              {BET_PRESETS.map(p => (
                <button key={p} className={`btn-ghost${bet === p ? ' btn-on' : ''}`} onClick={() => setBet(p)}>
                  {fmt(p)}
                </button>
              ))}
            </div>
            <input type="number" min={10} value={bet} onChange={e => setBet(Math.floor(Number(e.target.value) || 0))} className="mb-2" />
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={busy || (broke ? false : !canBet)}
              onClick={broke ? () => useGame.getState().setWallet(true) : () => void act('/blackjack/deal', { bet })}
            >
              {broke ? 'Пополни кошелёк' : countdown > 0 ? 'Играть сейчас' : view ? 'Новая раздача' : 'Раздать'}
            </button>
          </>
        )}

        <div className="hint text-center mt-2">
          Дилер добирает до 17. Блэкджек платит 3:2, победа 1:1, ничья — возврат. За столом до {cap} игроков, каждый играет против бота-дилера.
        </div>
      </div>
    </div>
  );
}
