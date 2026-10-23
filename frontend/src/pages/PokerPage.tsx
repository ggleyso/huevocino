import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, fmt } from '../api';
import { useGame } from '../store';
import { PlayingCard } from '../components/PlayingCard';
import { Confetti } from '../components/Confetti';
import { sfx } from '../sound';
import type { PokerView } from '../types';

const BET_PRESETS = [10, 50, 100, 500, 1000];

const RESULT_TEXT: Record<string, string> = {
  win: 'ПОБЕДА',
  lose: 'ПРОИГРЫШ',
  push: 'НИЧЬЯ',
};

const SEAT_STATUS: Record<string, { text: string; cls: string }> = {
  win: { text: 'ПОБЕДА', cls: 'gold' },
  lose: { text: 'ПРОИГРЫШ', cls: 'red' },
  push: { text: 'НИЧЬЯ', cls: 'grey' },
};

interface SeatRow {
  name: string;
  me: boolean;
  hand: PokerView | null;
}

export function PokerPage() {
  const [view, setView] = useState<PokerView | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [cap, setCap] = useState(4);
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(100);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const apply = useCallback((payload: { view?: PokerView; active?: PokerView | null; balance?: number; seats?: SeatRow[]; cap?: number }) => {
    if (payload.view !== undefined) setView(payload.view);
    else if (payload.active !== undefined && payload.active) setView(payload.active);
    if (typeof payload.balance === 'number') setBalance(payload.balance);
    if (payload.seats) setSeats(payload.seats);
    if (payload.cap) setCap(payload.cap);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await apiGet<{ active: PokerView | null; balance: number; seats: SeatRow[]; cap: number }>('/poker/state');
      if (!busyRef.current) apply(s);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(id);
  }, [refresh]);

  // звуки по переходам состояния
  const prevState = useRef<PokerView['state'] | null>(null);
  const [conf, setConf] = useState(0);
  useEffect(() => {
    const st: PokerView['state'] | null = view?.state ?? null;
    const prev = prevState.current;
    prevState.current = st;
    if (st === prev) return;
    if (st === 'decision') sfx.deal();
    else if (st === 'done' && view?.result) {
      if (view.result === 'win') {
        sfx.winCards();
        setConf(c => c + 1);
      } else if (view.result === 'push') sfx.push();
      else sfx.loseCards();
    }
  }, [view?.state, view?.result]);

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    busyRef.current = true;
    try {
      const r = await apiPost<{ view: PokerView; balance: number; seats: SeatRow[] }>(path, body);
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
      const r = await apiPost<{ ok: boolean; seats: SeatRow[]; cap: number }>('/poker/join');
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
      const r = await apiPost<{ ok: boolean; seats: SeatRow[]; cap: number }>('/poker/leave');
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
  const deciding = view?.state === 'decision';
  const canBet = bet >= 10 && bet <= balance;
  const broke = balance < 10;
  const empties = Math.max(0, cap - seats.length);

  return (
    <div className="game-page" style={{ position: 'relative' }}>
      <Confetti show={conf} />
      <div className="page-head">
        <h2>🂠 Покер против дилера</h2>
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
          <span className="felt-label">
            Дилер (бот) {view?.dealerHand && view.state === 'done' ? `· ${view.dealerHand}` : deciding ? '· одна карта открыта' : ''}
            {view?.dealerQualified === false && <b style={{ color: 'var(--accent)', marginLeft: 8 }}>не квалифицирован</b>}
          </span>
          <div className="cards-line">
            {view ? (
              view.dealer.map((c, i) => <PlayingCard key={i} card={c} hidden={view.state === 'decision' && i > 0} />)
            ) : (
              <span className="muted-text">Дилер ждёт первое анте</span>
            )}
          </div>
        </div>

        {view && view.result && view.state === 'done' && (
          <div className={`result-banner result-${view.result}`}>
            {RESULT_TEXT[view.result]} {view.payout > 0 ? `+${fmt(view.payout)} 🪙` : view.result === 'lose' ? `−${fmt(view.stake)} 🪙` : ''}
            <span className="result-mult">
              {' '}
              · {view.playerHand} vs {view.dealerHand}
            </span>
          </div>
        )}

        <div className="felt-row">
          <span className="felt-label">Вы {view?.playerHand && view.state === 'done' ? `· ${view.playerHand}` : ''}</span>
          <div className="cards-line">
            {view ? view.player.map((c, i) => <PlayingCard key={i} card={c} />) : <span className="muted-text">Сделай анте и нажми «Раздать»</span>}
          </div>
        </div>

        {view && view.note && view.state === 'done' && <div className="poker-note">{view.note}</div>}
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
            {me && !deciding && (
              <button className="btn-ghost" disabled={busy} onClick={standUp}>
                Встать
              </button>
            )}
          </div>
        </div>
        <div className="seats-row">
          {seats.map((s, i) => {
            const hideCards = !s.me && s.hand && s.hand.state === 'decision';
            return (
              <div key={`${s.name}-${i}`} className={`seat${s.me ? ' me' : ''}`}>
                <div className="seat-name">
                  {s.name}
                  {s.me && <span className="self-badge">вы</span>}
                </div>
                {s.hand ? (
                  <>
                    <div className="seat-cards">
                      {s.hand.state === 'done' || s.me
                        ? s.hand.player.map((c, j) => <PlayingCard key={j} card={c} small />)
                        : s.hand.player.map((_, j) => <PlayingCard key={j} small />)}
                      {hideCards && <span className="seat-hidden-note">карты скрыты</span>}
                    </div>
                    <div className="seat-meta">
                      <span className="seat-total">ante {fmt(s.hand.ante)}</span>
                      <span className="seat-bet">{s.hand.playerHand ?? ''}</span>
                    </div>
                    <span className={`seat-status ${s.hand.state === 'done' ? (SEAT_STATUS[s.hand.result ?? '']?.cls ?? '') : 'play'}`}>
                      {s.hand.state === 'done' ? (SEAT_STATUS[s.hand.result ?? '']?.text ?? 'ГОТОВО') : 'думает…'}
                    </span>
                  </>
                ) : (
                  <span className="seat-idle">жду анте…</span>
                )}
              </div>
            );
          })}
          {Array.from({ length: empties }).map((_, i) => (
            <div key={`e${i}`} className="seat empty">
              <span>Свободно</span>
            </div>
          ))}
        </div>
      </div>

      <div className="controls panel">
        {deciding ? (
          <div className="action-row">
            <button className="btn-ghost" disabled={busy} onClick={() => act('/poker/decide', { action: 'fold' })} style={{ flex: 1, padding: 14 }}>
              Фолд
            </button>
            <button className="btn-primary" disabled={busy || balance < (view?.callCost ?? 0)} onClick={() => act('/poker/decide', { action: 'call' })} style={{ flex: 2 }}>
              Колл +{fmt(view?.callCost ?? 0)} 🪙
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-2 flex-wrap items-center">
              <b style={{ fontSize: 14 }}>Анте</b>
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
              onClick={broke ? () => useGame.getState().setWallet(true) : () => void act('/poker/ante', { bet })}
            >
              {broke ? 'Пополни кошелёк' : 'Раздать'}
            </button>
          </>
        )}

        <div className="hint text-center mt-2">
          Дилер играет от Q-high. Квал — анте и колл 1:1, неквал — только анте 1:1, колл возвращается. За столом до {cap} игроков, каждый против бота-дилера.
        </div>
      </div>
    </div>
  );
}
