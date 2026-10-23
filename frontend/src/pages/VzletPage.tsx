import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store';
import { Flight } from '../components/Flight';
import { Confetti } from '../components/Confetti';
import { apiPost, fmt } from '../api';
import { sfx } from '../sound';

const BET_PRESETS = [10, 50, 100, 500, 1000];
const AUTO_OPTS = [0, 1.5, 2, 3, 5, 10];

export function VzletPage() {
  const { data, phase, round, crashAt, result, cashedOut, bet, autoCashout, setBet, setAutoCashout, start, cashout, setMult, setError, setWallet } = useGame();
  const firstRender = useRef(true);
  const [, setTick] = useState(0);
  const [conf, setConf] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick(x => x + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (phase === 'flying') sfx.takeoff();
    else if (phase === 'ended' && result && !result.win) sfx.boom();
    if (phase === 'ended' && result?.win && result.payout >= (data?.limits.minBet ?? 10) * 3 && result.multiplier != null && result.multiplier >= 3) {
      setConf(c => c + 1);
    }
  }, [phase, result, data]);

  const balance = data?.balance ?? 0;
  const stats = data?.stats;
  const flying = phase === 'flying';
  const minBet = data?.limits.minBet ?? 10;
  const broke = balance < minBet;
  const canBet = !flying && bet >= minBet && bet <= balance;
  const history = data?.history ?? [];
  const chips = history.slice(0, 14);

  const faucet = async () => {
    try {
      await apiPost('/faucet');
      await useGame.getState().load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const bonusReady = data?.bonus?.ready ?? true;
  const bonusLeft = Math.max(0, (data?.bonus?.nextTs ?? 0) - Date.now());
  const bonusH = Math.floor(bonusLeft / 3_600_000);
  const bonusM = Math.floor((bonusLeft % 3_600_000) / 60_000);

  const claimBonus = async () => {
    try {
      await apiPost<{ balance: number }>('/bonus');
      sfx.win(true);
      setError(null);
      await useGame.getState().load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="vzlet" style={{ position: 'relative' }}>
      <Confetti show={conf} />
      <div className="vzlet-col vzlet-main">
        <Flight phase={phase} startTs={round?.startTs ?? null} crashAt={crashAt} result={result} onTick={setMult} />

        <div className="chips-row">
          {chips.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 12 }}>История раундов появится после первого полёта</span>}
          {chips.map(h => {
            const v = h.cashoutAt ?? h.crashAt;
            const color = v == null ? 'var(--muted)' : v >= 10 ? 'var(--gold)' : v >= 2 ? '#8ea2e8' : 'var(--red)';
            return (
              <span key={h.id} className="chip" style={{ fontSize: 12, fontWeight: 700, color }}>
                {v != null ? `${v.toFixed(2)}×` : '—'}
                {h.win ? ' ✓' : ''}
              </span>
            );
          })}
        </div>

        {stats && stats.rounds > 0 && (
          <div className="panel stats-grid" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            <div className="flex justify-between">
              <span>Раундов</span>
              <b style={{ color: 'var(--text)' }}>{stats.rounds}</b>
            </div>
            <div className="flex justify-between">
              <span>Побед</span>
              <b style={{ color: 'var(--green)' }}>{stats.wins}</b>
            </div>
            <div className="flex justify-between">
              <span>Лучший множитель</span>
              <b style={{ color: 'var(--gold)' }}>x{stats.best.toFixed(2)}</b>
            </div>
            <div className="flex justify-between">
              <span>Винрейт</span>
              <b style={{ color: 'var(--text)' }}>{Math.round((stats.wins / stats.rounds) * 100)}%</b>
            </div>
          </div>
        )}
      </div>

      <div className="vzlet-col vzlet-side">
        <div className="panel">
          <div className="flex items-center justify-between mb-2">
            <b style={{ fontSize: 14 }}>Ставка</b>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Мин {data?.limits.minBet ?? 10} · Макс {fmt(data?.limits.maxBet ?? 100000)}
            </span>
          </div>

          <div className="flex gap-2 mb-2 flex-wrap">
            {BET_PRESETS.map(p => (
              <button key={p} className={`btn-ghost${bet === p ? ' btn-on' : ''}`} disabled={flying} onClick={() => setBet(p)}>
                {fmt(p)}
              </button>
            ))}
            <button className="btn-ghost" disabled={flying} onClick={() => setBet(Math.max(data?.limits.minBet ?? 10, balance))} style={{ opacity: 0.8 }}>
              Макс
            </button>
          </div>

          <input
            type="number"
            value={bet}
            disabled={flying}
            onChange={e => setBet(Math.floor(Number(e.target.value) || 0))}
            style={{ marginBottom: 12, opacity: flying ? 0.5 : 1 }}
          />

          <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Авто-вывод:</span>
            {AUTO_OPTS.map(v => (
              <button
                key={v}
                className={`btn-ghost${autoCashout === v ? ' btn-on' : ''}`}
                style={{ padding: '4px 9px', fontSize: 12 }}
                onClick={() => setAutoCashout(v)}
              >
                {v === 0 ? 'ВЫКЛ' : `${v}×`}
              </button>
            ))}
          </div>
          {flying && autoCashout > 0 && !cashedOut && (
            <div className="join-countdown" style={{ marginBottom: 10, animation: 'none' }}>
              ⏱ выведем автоматически на <b>{autoCashout.toFixed(2)}×</b>
            </div>
          )}

          {!flying ? (
            <button className="btn-primary" style={{ width: '100%' }} disabled={flying || (broke ? false : !canBet)} onClick={broke ? () => setWallet(true) : start}>
              {broke ? 'Пополни кошелёк' : '✈ В ВОЗДУХ'}
            </button>
          ) : cashedOut ? (
            <button className="btn-ghost" style={{ width: '100%', padding: 14, fontSize: 15, color: 'var(--gold)', fontWeight: 700 }} disabled>
              ✓ Забрано {fmt(useGame.getState().result?.payout ?? 0)} 🪙 — ждём падение
            </button>
          ) : (
            <button
              className="btn-cashout"
              style={{ width: '100%' }}
              onClick={() => {
                sfx.cashout();
                cashout();
              }}
            >
              ЗАБРАТЬ {fmt(Math.floor(bet * useGame.getState().mult))} 🪙 ({useGame.getState().mult.toFixed(2)}×)
            </button>
          )}
        </div>

        <div className="hint text-center mt-2">
          Монеты — внутриигровая валюта. Комиссия {data?.commission.percent ?? 5}% при пополнении.
          <br />
          <button
            className="btn-ghost"
            style={{ marginTop: 6, padding: '3px 8px', fontSize: 11, color: bonusReady ? 'var(--green)' : undefined }}
            disabled={!bonusReady}
            onClick={() => void claimBonus()}
          >
            {bonusReady ? '🎁 Ежедневный бонус +500' : `🎁 Бонус через ${bonusH}ч ${bonusM}м`}
          </button>
          <button className="btn-ghost" style={{ marginLeft: 8, padding: '3px 8px', fontSize: 11 }} onClick={faucet}>
            🎁 +1000
          </button>
        </div>
      </div>
    </div>
  );
}
