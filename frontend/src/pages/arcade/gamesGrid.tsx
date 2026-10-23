import { useState } from 'react';
import { fmt } from '../../api';
import { useGame } from '../../store';
import { sfx } from '../../sound';
import { BetBar, ArcadeResult, type GameProps } from './shared';
import { PlayingCard } from '../../components/PlayingCard';

// ---------- 💣 Сапёр ----------
export function MinesGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;
  const size = (view?.size as number | undefined) ?? 5;
  const opened = new Set((view?.opened as number[] | undefined) ?? []);
  const exploded = new Set((view?.exploded as number[] | undefined) ?? []);
  const mult = (view?.mult as number | undefined) ?? 1;
  const done = phase === 'done';
  const cashed = (view?.cashout as number | undefined) ?? 0;
  const [hover, setHover] = useState<number | null>(null);

  if (phase !== 'play' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="mines-preview">
          {Array.from({ length: size * size }).map((_, i) => (
            <div key={i} className="mine-cell closed" />
          ))}
        </div>
        <div className="hint text-center">5 мин на 25 клеток. Открывай — множитель растёт, взрыв — ставка сгорает.</div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={() => void act('start', { bet })}>
            НАЧАТЬ РАУНД
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  return (
    <div className="arcade-game">
      <div className="mines-head">
        <span>⛏ ×{mult.toFixed(2)}</span>
        <b>{fmt(Math.floor(bet * mult))} 🪙</b>
        {done && cashed > 0 && <span className="gold">+{fmt(cashed)}</span>}
      </div>
      <div className="mines-grid">
        {Array.from({ length: size * size }).map((_, i) => {
          const isOpen = opened.has(i);
          const isBoom = exploded.has(i);
          return (
            <button
              key={i}
              className={`mine-cell ${isBoom ? 'boom' : isOpen ? 'open' : done ? 'reveal' : ''}`}
              disabled={busy || done || isOpen}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => { sfx.reelStop(); void act('open', { cell: i }); }}
            >
              {isBoom ? '💣' : isOpen ? '💎' : done && hover === i ? '?' : ''}
            </button>
          );
        })}
      </div>
      {done && (
        <ArcadeResult
          win={cashed > 0}
          text={cashed > 0 ? 'ВЫ ЗАБРАЛИ' : 'ПОДОРВАЛИСЬ'}
          amount={cashed}
        />
      )}
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      {!done ? (
        <div className="arcade-actions">
          <button className="btn-cashout" style={{ flex: 1, animation: 'none', padding: 14 }} disabled={busy || opened.size === 0} onClick={() => { sfx.cashout(); void act('cashout'); }}>
            ЗАБРАТЬ ×{mult.toFixed(2)}
          </button>
        </div>
      ) : (
        <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void act('start', { bet })}>
          НОВЫЙ РАУНД
        </button>
      )}
    </div>
  );
}

// ---------- 🪜 Лестница ----------
export function LadderGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;
  const risks = (view?.risks as { id: string; label: string; p: number; topMult: number }[] | undefined) ?? [];
  const step = (view?.step as number | undefined) ?? 0;
  const steps = (view?.steps as number | undefined) ?? 8;
  const risk = (view?.risk as string | undefined) ?? 'mid';
  const mult = (view?.mult as number | undefined) ?? 1;
  const nextMult = view?.nextMult as number | null | undefined;
  const result = view?.result as string | null | undefined;
  const payout = (view?.payout as number | undefined) ?? 0;
  const [sel, setSel] = useState('mid');

  if (phase !== 'play' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="risk-cards">
          {risks.map(r => (
            <button key={r.id} className={`risk-card${sel === r.id ? ' on' : ''}`} disabled={busy} onClick={() => setSel(r.id)}>
              <b>{r.label}</b>
              <span>{Math.round(r.p * 100)}% / шаг</span>
              <span className="gold">до ×{r.topMult}</span>
            </button>
          ))}
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={() => void act('start', { bet, risk: sel })}>
            НАЧАТЬ ПОДЪЁМ
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  return (
    <div className="arcade-game">
      <div className="ladder-track">
        {Array.from({ length: steps }).map((_, i) => {
          const idx = steps - 1 - i;
          const reached = idx < step;
          return (
            <div key={i} className={`ladder-rung${reached ? ' reached' : ''}${idx === step && phase === 'play' ? ' current' : ''}`}>
              <span>×{(view?.mult as number) && idx + 1 <= step ? '' : ''}{idx + 1}</span>
              <b>{reached ? '✓' : ''}</b>
            </div>
          );
        })}
      </div>
      <div className="mines-head">
        <span>{view?.riskLabel as string} · шаг {step}/{steps}</span>
        <b>×{mult.toFixed(2)} → {fmt(Math.floor(bet * mult))} 🪙</b>
      </div>
      {phase === 'done' && <ArcadeResult win={result !== 'lose'} text={result === 'lose' ? 'СОРВАЛИСЬ' : result === 'top' ? 'ВЕРШИНА!' : 'ЗАБРАНО'} amount={payout} />}
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      {phase === 'play' ? (
        <div className="arcade-actions">
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => { sfx.tick(); void act('step'); }}>
            ШАГ ВВЕРХ → {nextMult ? `×${nextMult.toFixed(2)}` : ''}
          </button>
          <button className="btn-cashout" style={{ flex: 1, animation: 'none', padding: 14 }} disabled={busy || step === 0} onClick={() => { sfx.cashout(); void act('cashout'); }}>
            ЗАБРАТЬ
          </button>
        </div>
      ) : (
        <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void act('start', { bet, risk })}>
          СНОВА
        </button>
      )}
    </div>
  );
}

// ---------- 🐔 Цыплёнок ----------
export function ChickenGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;
  const risks = (view?.risks as { id: number; label: string; p: number }[] | undefined) ?? [];
  const lane = (view?.lane as number | undefined) ?? 0;
  const lanes = (view?.lanes as number | undefined) ?? 6;
  const mult = (view?.mult as number | undefined) ?? 1;
  const nextMult = view?.nextMult as number | null | undefined;
  const result = view?.result as string | null | undefined;
  const payout = (view?.payout as number | undefined) ?? 0;
  const [sel, setSel] = useState(1);

  if (phase !== 'play' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="risk-cards">
          {risks.map(r => (
            <button key={r.id} className={`risk-card${sel === r.id ? ' on' : ''}`} disabled={busy} onClick={() => setSel(r.id)}>
              <b>{r.label}</b>
              <span>{Math.round(r.p * 100)}% / полоса</span>
            </button>
          ))}
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={() => void act('start', { bet, risk: sel })}>
            ПУСТИТЬ ЦЫПЛЁНКА
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  const dead = phase === 'done' && result === 'lose';
  return (
    <div className="arcade-game">
      <div className="road-stage">
        {Array.from({ length: lanes }).map((_, i) => {
          const idx = lanes - 1 - i;
          return (
            <div key={i} className={`road-lane${idx < lane ? ' crossed' : ''}${idx === lane && phase === 'play' ? ' here' : ''}`}>
              <span className="road-num">#{idx + 1}</span>
              {idx === lane && <span className={`road-chick ${dead ? 'dead' : ''}`}>🐔</span>}
              {idx < lane && <span className="road-chick">🐔</span>}
            </div>
          );
        })}
      </div>
      <div className="mines-head">
        <span>{view?.riskLabel as string ?? risks[sel]?.label} · {lane}/{lanes}</span>
        <b>×{mult.toFixed(2)} → {fmt(Math.floor(bet * mult))} 🪙</b>
      </div>
      {phase === 'done' && <ArcadeResult win={result !== 'lose'} text={result === 'lose' ? 'СБИЛИ! 🚗💥' : result === 'end' ? 'ДОБЕЖАЛ!' : 'ЗАБРАНО'} amount={payout} />}
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      {phase === 'play' ? (
        <div className="arcade-actions">
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => { sfx.tick(); void act('cross'); }}>
            ПЕРЕБЕЖАТЬ → {nextMult ? `×${nextMult.toFixed(2)}` : ''}
          </button>
          <button className="btn-cashout" style={{ flex: 1, animation: 'none', padding: 14 }} disabled={busy || lane === 0} onClick={() => { sfx.cashout(); void act('cashout'); }}>
            ЗАБРАТЬ
          </button>
        </div>
      ) : (
        <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void act('start', { bet, risk: sel })}>
          ЕЩЁ РАЗ
        </button>
      )}
    </div>
  );
}

// ---------- 🌟 Кено ----------
export function KenoGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const pool = (view?.pool as number | undefined) ?? 12;
  const need = (view?.pick as number | undefined) ?? 5;
  const pay = (view?.pay as Record<string, number> | undefined) ?? {};
  const last = view?.last as { picked: number[]; drawn: number[]; hits: number; payout: number } | null;
  const [picked, setPicked] = useState<number[]>([]);

  const toggle = (n: number) => {
    sfx.click();
    setPicked(p =>
      p.includes(n) ? p.filter(x => x !== n) : p.length >= need ? p : [...p, n],
    );
  };

  const draw = async () => {
    if (busy || picked.length !== need || bet > balance) return;
    sfx.spin();
    await act('draw', { bet, picked });
    const v = api.view?.last as { payout: number } | null;
    if (v) v.payout > 0 ? sfx.win(true) : sfx.lose();
  };

  return (
    <div className="arcade-game">
      <div className="keno-grid">
        {Array.from({ length: pool }).map((_, i) => {
          const isPicked = picked.includes(i);
          const isDrawn = last?.drawn.includes(i);
          const isHit = isPicked && isDrawn;
          return (
            <button key={i} className={`keno-num${isPicked ? ' picked' : ''}${isHit ? ' hit' : ''}${isDrawn && !isPicked ? ' drawn' : ''}`} disabled={busy || last !== null && busy} onClick={() => toggle(i)}>
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs muted-text">
        <span>выбрано {picked.length}/{need}</span>
        <span>{Object.entries(pay).map(([k, v]) => `${k}=${v}×`).join(' · ')}</span>
      </div>
      {last && (
        <ArcadeResult win={last.payout > 0} text={`СОВПАДЕНИЙ: ${last.hits} из ${last.drawn.length} выпавших`} amount={last.payout} />
      )}
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
        <button className="btn-ghost" disabled={busy} onClick={() => setPicked(Array.from({ length: need }, () => Math.floor(Math.random() * pool)).filter((v, i, a) => a.indexOf(v) === i).slice(0, need))}>
          🎲 Случайно
        </button>
        <button className="btn-primary" style={{ flex: 1 }} disabled={busy || picked.length !== need || bet > balance || bet < 10} onClick={draw}>
          ИЗВЛЕЧЬ
        </button>
      </BetBar>
      <div className="hint text-center">3 совпадения ×3, 4 ×20, все 5 ×150. Числа 1–12, тянем 5.</div>
      {balance < 10 && <button className="btn-ghost" onClick={() => useGame.getState().setWallet(true)}>Пополнить кошелёк</button>}
    </div>
  );
}

// ---------- ⭕ Крестики-нолики ----------
export function TicTacToeGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;
  const board = (view?.board as ('X' | 'O' | null)[] | undefined) ?? Array(9).fill(null);
  const winLine = view?.winLine as number[] | null | undefined;
  const result = view?.result as string | null | undefined;
  const payout = (view?.payout as number | undefined) ?? 0;

  if (phase !== 'play' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="ttt-board idle">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="ttt-cell" />
          ))}
        </div>
        <div className="hint text-center">Ты играешь ❌ и ходишь первым. Победа ×1.9, ничья — возврат ставки.</div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={() => void act('start', { bet })}>
            НОВАЯ ПАРТИЯ
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  const over = phase === 'done';
  return (
    <div className="arcade-game">
      <div className="ttt-board">
        {board.map((c, i) => (
          <button
            key={i}
            className={`ttt-cell${c ? ` filled ${c.toLowerCase()}` : ''}${winLine?.includes(i) ? ' winline' : ''}`}
            disabled={busy || over || c !== null}
            onClick={() => { sfx.click(); void act('move', { cell: i }); }}
          >
            {c}
          </button>
        ))}
      </div>
      {over && <ArcadeResult win={result === 'win'} text={result === 'win' ? 'ТЫ ПОБЕДИЛ!' : result === 'draw' ? 'НИЧЬЯ — СТАВКА ВЕРНУЛАСЬ' : 'ИИ СИЛЬНЕЕ'} amount={result === 'win' ? payout : result === 'draw' ? payout : 0} />}
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      {over ? (
        <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void act('start', { bet })}>
          НОВАЯ ПАРТИЯ
        </button>
      ) : (
        <div className="hint text-center">Твой ход — выбери клетку</div>
      )}
    </div>
  );
}

// ---------- 🀄 карточная заглушка для PlayingCard в хедере ----------
export { PlayingCard };
