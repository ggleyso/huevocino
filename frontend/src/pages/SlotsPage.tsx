import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost, fmt } from '../api';
import { useGame } from '../store';
import { SlotIcon, SYMBOL_NAMES } from '../components/SlotIcon';
import { Confetti } from '../components/Confetti';
import { sfx } from '../sound';
import type { SlotInfo, SpinResult } from '../types';

const BET_PRESETS = [10, 50, 100, 500, 1000];
const LINE_NAMES = ['Средняя', 'Верхняя', 'Нижняя', 'V', 'Λ'];

export function SlotsPage() {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [active, setActive] = useState<string>('dog');
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(100);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [strips, setStrips] = useState<string[][] | null>(null);
  const [last, setLast] = useState<SpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [conf, setConf] = useState(0);
  const timer = useRef<number | null>(null);

  const betRef = useRef(bet);
  const balRef = useRef(balance);
  const activeRef = useRef(active);
  const autoRef = useRef(0);
  const spinningRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});

  useEffect(() => {
    betRef.current = bet;
    balRef.current = balance;
    activeRef.current = active;
  });

  useEffect(() => {
    (async () => {
      try {
        const s = await apiGet<{ slots: SlotInfo[]; balance: number }>('/slots');
        setSlots(s.slots);
        setBalance(s.balance);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    return () => {
      autoRef.current = 0;
      if (timer.current) {
        window.clearTimeout(timer.current);
        void useGame.getState().load();
      }
    };
  }, []);

  const cfg = slots.find(s => s.id === active) ?? slots[0];

  useEffect(() => {
    if (last && last.payout >= bet * 5) setConf(c => c + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  const winCells = useMemo(() => {
    const set = new Set<string>();
    if (!last || !cfg) return set;
    for (const w of last.wins) {
      if (w.line === null) {
        last.grid.forEach((col, r) =>
          col.forEach((sym, row) => {
            if (sym === cfg.symbols[cfg.scatter]) set.add(`${r}:${row}`);
          }),
        );
      } else {
        const rows = cfg.lines[w.line];
        if (!rows) continue;
        for (let i = 0; i < w.count && i < rows.length; i++) set.add(`${i}:${rows[i]}`);
      }
    }
    return set;
  }, [last, cfg]);

  const spin = async () => {
    const b = betRef.current;
    const bal = balRef.current;
    const slotId = activeRef.current;
    if (spinningRef.current || b < 10 || b > bal) {
      if (autoRef.current > 0) {
        autoRef.current = 0;
        setAuto(0);
      }
      return;
    }
    spinningRef.current = true;
    setSpinning(true);
    setLast(null);
    setErr(null);
    sfx.spin();
    try {
      const r = await apiPost<SpinResult>(`/slots/${slotId}/spin`, { bet: b });
      const symbols = slots.find(s => s.id === slotId)?.symbols ?? ['⭐'];
      const rand = () => symbols[Math.floor(Math.random() * symbols.length)];
      setStrips(r.grid.map(col => [...Array.from({ length: 6 }, rand), ...col]));
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setGrid(r.grid);
        setLast(r);
        setBalance(r.balance);
        setStrips(null);
        setSpinning(false);
        spinningRef.current = false;
        balRef.current = r.balance;
        sfx.reelStop();
        if (r.payout > 0) sfx.win(r.payout >= b * 5);
        else sfx.lose();
        void useGame.getState().load();
        if (autoRef.current > 0) {
          if (r.balance >= b) {
            autoRef.current -= 1;
            setAuto(autoRef.current);
            timer.current = window.setTimeout(() => {
              timer.current = null;
              void spinRef.current();
            }, 700);
          } else {
            autoRef.current = 0;
            setAuto(0);
          }
        }
      }, 850);
    } catch (e) {
      setErr((e as Error).message);
      setStrips(null);
      setSpinning(false);
      spinningRef.current = false;
      autoRef.current = 0;
      setAuto(0);
    }
  };

  useEffect(() => {
    spinRef.current = () => void spin();
  });

  const startAuto = () => {
    if (autoRef.current > 0) {
      autoRef.current = 0;
      setAuto(0);
      return;
    }
    autoRef.current = 10;
    setAuto(10);
    if (!spinningRef.current) void spinRef.current();
  };

  const stepBet = (dir: 1 | -1) => {
    const step = bet >= 1000 ? 100 : bet >= 100 ? 50 : 10;
    const next = Math.min(Math.max(bet + dir * step, 10), Math.min(balance, 100000));
    setBet(next);
  };

  const cells = strips ?? grid ?? Array.from({ length: 5 }, () => ['❓', '❓', '❓']);
  const canSpin = !spinning && !!cfg && bet >= 10 && bet <= balance && balance >= 10;

  const pickSlot = (id: string) => {
    if (spinning || id === active) return;
    autoRef.current = 0;
    setAuto(0);
    setActive(id);
    setGrid(null);
    setLast(null);
    setStrips(null);
    setErr(null);
  };

  return (
    <div className="game-page slots-page">
      <div className="page-head">
        <h2>🎰 Слоты</h2>
        <span className="balance-pill">🪙 {fmt(balance)}</span>
      </div>

      {err && (
        <div className="err-banner" onClick={() => setErr(null)}>
          {err}
        </div>
      )}

      <div className="slot-tabs">
        {slots.map(s => (
          <button key={s.id} className={`slot-tab${s.id === active ? ' on' : ''}`} onClick={() => pickSlot(s.id)} disabled={spinning}>
            <SlotIcon sym={s.icon} size={24} /> {s.name}
          </button>
        ))}
      </div>

      <div className={`slots-stage theme-${active}`}>
        <Confetti show={conf} />
        <div className="stage-deco">
          <span className="cloud c1" />
          <span className="cloud c2" />
          <span className="cloud c3" />
        </div>

        <div className={`slot-frame fr-${cfg?.frame ?? 'wood'}`}>
          <div className="slot-plaque">
            <SlotIcon sym={cfg?.icon ?? '⭐'} size={24} />
            {cfg?.name ?? '…'}
          </div>

          <div className="slot-grid">
            {cells.map((col, ri) => (
              <div className="slot-reel" key={ri}>
                {strips ? (
                  <div className="reel-strip" style={{ animationDelay: `${ri * 0.05}s` }}>
                    {col.map((sym, i) => (
                      <div className="slot-cell" key={i}>
                        <SlotIcon sym={sym} />
                      </div>
                    ))}
                  </div>
                ) : (
                  col.map((sym, rowi) => (
                    <div className={`slot-cell${winCells.has(`${ri}:${rowi}`) ? ' win' : ''}`} key={rowi}>
                      <SlotIcon sym={sym} />
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>

          {last && !spinning && (
            <div className={`slot-outcome${last.payout > 0 ? ' win' : ''}`}>{last.payout > 0 ? `ВЫИГРЫШ +${fmt(last.payout)} 🪙` : 'Без выигрыша'}</div>
          )}

          <div className="slot-hud">
            <div className="hud-balance">
              <span className="hud-label">Баланс</span>
              <b>🪙 {fmt(balance)}</b>
            </div>

            <div className="bet-ctl">
              <button className="round-btn" disabled={spinning || bet <= 10} onClick={() => stepBet(-1)}>
                −
              </button>
              <div className="bet-val">
                <span className="hud-label">Ставка</span>
                <b>{fmt(bet)} 🪙</b>
              </div>
              <button className="round-btn" disabled={spinning || bet >= balance} onClick={() => stepBet(1)}>
                +
              </button>
            </div>

            <button className={`spin-btn${spinning ? ' rolling' : ''}`} disabled={!canSpin} onClick={spin} aria-label="Крутить">
              ⟳
            </button>

            <button className={`btn-ghost${auto > 0 ? ' btn-on' : ''}`} style={{ padding: '10px 12px', fontWeight: 800 }} disabled={auto === 0 && !canSpin} onClick={startAuto}>
              {auto > 0 ? `⏹ ${auto}` : 'АВТО ×10'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {BET_PRESETS.map(p => (
          <button key={p} className={`btn-ghost${bet === p ? ' btn-on' : ''}`} disabled={spinning} onClick={() => setBet(p)}>
            {fmt(p)}
          </button>
        ))}
        <button className="btn-ghost" disabled={spinning} onClick={() => setBet(Math.max(10, balance))}>
          Макс
        </button>
      </div>

      {balance < 10 && !spinning && (
        <div className="panel flex items-center justify-between" style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>Монет не хватает на ставку</span>
          <button className="btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => useGame.getState().setWallet(true)}>
            Пополнить
          </button>
        </div>
      )}

      {last && last.wins.length > 0 && !spinning && (
        <div className="wins-list panel">
          {last.wins.map((w, i) => (
            <div key={i} className="flex justify-between win-row items-center">
              <span className="flex items-center gap-1">
                <SlotIcon sym={cfg?.symbols[w.symbol] ?? '?'} size={20} />
                {w.line === null ? 'Скаттеры' : `Линия «${LINE_NAMES[w.line] ?? w.line}»`} · {w.count}× {SYMBOL_NAMES[cfg?.symbols[w.symbol] ?? ''] ?? cfg?.symbols[w.symbol]}
              </span>
              <b style={{ color: 'var(--gold)' }}>+{fmt(w.amount)} 🪙</b>
            </div>
          ))}
        </div>
      )}

      <div className="hint text-center">Звезда — вилд, заменяет любой символ. 3+ скаттера (иконка слота в плашке) платят ×2/×10/×50 от ставки в любом месте.</div>
    </div>
  );
}
