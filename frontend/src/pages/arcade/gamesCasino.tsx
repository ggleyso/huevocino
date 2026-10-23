import { useState } from 'react';
import { fmt } from '../../api';
import { useGame } from '../../store';
import { sfx } from '../../sound';
import { BetBar, ArcadeResult, type GameProps } from './shared';

// ---------- 🎯 Рулетка ----------
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function numColor(n: number): string {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

export function RouletteGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const last = view?.last as { num: number; color: string; payout: number } | null;
  const [spin, setSpin] = useState(false);

  const betOn = async (type: string, value?: number) => {
    if (busy || bet > balance || bet < 10) return;
    setSpin(true);
    sfx.spin();
    await act('bet', { bet, type, value });
    setSpin(false);
    const v = api.view?.last as { payout: number } | null;
    if (v) v.payout > 0 ? sfx.win(true) : sfx.lose();
  };

  return (
    <div className="arcade-game">
      <div className="roulette-stage">
        <div className={`roulette-ball ${spin ? 'spinning' : ''}`}>
          <div className="roulette-wheel">
            {Array.from({ length: 37 }).map((_, i) => (
              <div key={i} className={`roulette-seg ${numColor(i)}`} style={{ transform: `rotate(${i * (360 / 37)}deg)` }} />
            ))}
          </div>
          {last && (
            <div className={`roulette-result ${last.color}`}>
              {last.num}
            </div>
          )}
        </div>
        {last && (
          <ArcadeResult
            win={last.payout > 0}
            text={last.num === 0 ? 'ЗЕРО!' : `${last.num} — ${last.color === 'red' ? 'КРАСНОЕ' : last.color === 'black' ? 'ЧЁРНОЕ' : 'ЗЕЛЁНОЕ'}`}
            amount={last.payout}
          />
        )}
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>

      <div className="roulette-bets">
        <div className="roulette-row">
          <button className="btn-primary rl-btn" disabled={busy} onClick={() => void betOn('red')} style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}>
            КРАСНОЕ ×2
          </button>
          <button className="btn-primary rl-btn" disabled={busy} onClick={() => void betOn('black')} style={{ background: 'linear-gradient(135deg, #1f2937, #111827)' }}>
            ЧЁРНОЕ ×2
          </button>
        </div>
        <div className="roulette-row">
          <button className="btn-ghost rl-btn" disabled={busy} onClick={() => void betOn('even')}>ЧЁТ ×2</button>
          <button className="btn-ghost rl-btn" disabled={busy} onClick={() => void betOn('odd')}>НЕЧЕТ ×2</button>
          <button className="btn-ghost rl-btn" disabled={busy} onClick={() => void betOn('low')}>1-18 ×2</button>
          <button className="btn-ghost rl-btn" disabled={busy} onClick={() => void betOn('high')}>19-36 ×2</button>
        </div>
        <div className="roulette-row">
          <button className="btn-ghost rl-btn" disabled={busy} onClick={() => void betOn('dozen', 1)}>1-12 ×3</button>
          <button className="btn-ghost rl-btn" disabled={busy} onClick={() => void betOn('dozen', 2)}>13-24 ×3</button>
          <button className="btn-ghost rl-btn" disabled={busy} onClick={() => void betOn('dozen', 3)}>25-36 ×3</button>
        </div>
        <div className="roulette-numbers">
          <button className="rl-zero" disabled={busy} onClick={() => void betOn('straight', 0)}>0</button>
          {Array.from({ length: 36 }).map((_, i) => (
            <button key={i + 1} className={`rl-num ${numColor(i + 1)}`} disabled={busy} onClick={() => void betOn('straight', i + 1)}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy} />
      <div className="hint text-center">Прямая ставка ×35, цвет/чёт-нечет ×2, дюжина ×3. Зеро — проигрыш всех ставок.</div>
    </div>
  );
}

// ---------- 🎱 Плинко ----------
const PLINKO_RISKS: Record<string, { label: string; multipliers: number[] }> = {
  low: { label: 'Низкий', multipliers: [16, 9, 2, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 2, 9, 16] },
  mid: { label: 'Средний', multipliers: [32, 11, 3.8, 1.9, 1.1, 0.57, 0.28, 0.57, 1.1, 1.9, 3.8, 11, 32] },
  high: { label: 'Высокий', multipliers: [110, 41, 10, 3, 1.3, 0.4, 0.2, 0.4, 1.3, 3, 10, 41, 110] },
};

export function PlinkoGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const last = view?.last as { mult: number; payout: number; slot: number } | null;
  const [risk, setRisk] = useState('mid');
  const [ballPos, setBallPos] = useState<number | null>(null);
  const cfg = PLINKO_RISKS[risk];

  const drop = async () => {
    if (busy || bet > balance || bet < 10) return;
    sfx.tick();
    await act('drop', { bet, risk });
    const v = api.view?.last as { slot: number; payout: number; mult: number } | null;
    if (v) {
      setBallPos(v.slot);
      v.payout >= 0 ? sfx.win(v.mult >= 3) : sfx.lose();
    }
  };

  return (
    <div className="arcade-game">
      <div className="plinko-stage">
        <div className="plinko-pyramid">
          {Array.from({ length: 13 }).map((_, row) => (
            <div key={row} className="plinko-row" style={{ paddingLeft: `${(12 - row) * 8}px` }}>
              {Array.from({ length: row + 1 }).map((_, i) => (
                <div key={i} className="plinko-pin" />
              ))}
            </div>
          ))}
        </div>
        <div className="plinko-slots">
          {cfg.multipliers.map((m, i) => (
            <div key={i} className={`plinko-slot ${m >= 3 ? 'high' : m >= 1 ? 'mid' : 'low'}${ballPos === i ? ' hit' : ''}`}>
              {m}
            </div>
          ))}
        </div>
      </div>

      <div className="risk-cards">
        {Object.entries(PLINKO_RISKS).map(([id, r]) => (
          <button key={id} className={`risk-card${risk === id ? ' on' : ''}`} disabled={busy} onClick={() => setRisk(id)}>
            <b>{r.label}</b>
            <span>до ×{r.multipliers[0]}</span>
          </button>
        ))}
      </div>

      {last && <ArcadeResult win={last.payout >= 0} text={`×${last.mult}`} amount={last.payout} />}
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}

      <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
        <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={drop}>
          🎱 БРОСИТЬ
        </button>
      </BetBar>
    </div>
  );
}

// ---------- 🎈 Шарик ----------
export function BalloonGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;
  const mult = (view?.mult as number | undefined) ?? 1;
  const pumps = (view?.pumps as number | undefined) ?? 0;
  const payout = (view?.payout as number | undefined) ?? 0;
  const [pop, setPop] = useState(false);

  if (phase !== 'play' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="balloon-stage idle">
          <div className="balloon idle-balloon">🎈</div>
          <div className="balloon-text">Надувай — множитель растёт. Шанс лопнуть: 12% + 2% за каждый качок.</div>
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={() => void act('start', { bet })}>
            НАДУТЬ 🎈
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  const size = 80 + pumps * 18;
  const dead = phase === 'done' && payout === 0;

  return (
    <div className="arcade-game">
      <div className="balloon-stage">
        <div
          className={`balloon ${dead ? 'popped' : ''}`}
          style={{ fontSize: `${Math.min(size, 180)}px`, filter: dead ? 'grayscale(1) opacity(0.4)' : undefined }}
          onClick={() => { if (phase === 'play') { setPop(true); setTimeout(() => setPop(false), 300); } }}
        >
          {dead ? '💥' : '🎈'}
        </div>
        <div className={`balloon-mult ${dead ? 'dead' : ''}`}>×{mult.toFixed(2)}</div>
        {phase === 'done' && (
          <ArcadeResult
            win={payout > 0}
            text={payout > 0 ? 'ЗАБРАЛ!' : 'ЛОПНУЛ!'}
            amount={payout}
          />
        )}
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>

      {phase === 'play' ? (
        <div className="arcade-actions">
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => { sfx.tick(); void act('pump'); }}>
            ⚡ КАЧНУТЬ → ×{(1 + (pumps + 1) * 0.15 + (pumps + 1) * (pumps + 1) * 0.03).toFixed(2)}
          </button>
          <button className="btn-cashout" style={{ flex: 1, animation: 'none', padding: 14 }} disabled={busy || pumps === 0} onClick={() => { sfx.cashout(); void act('cashout'); }}>
            ЗАБРАТЬ ×{mult.toFixed(2)}
          </button>
        </div>
      ) : (
        <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void act('start', { bet })}>
          НОВЫЙ ШАРИК
        </button>
      )}
      <div className="hint text-center">Каждый качок +15% + квадрат. Шанс лопнуть: 12% → 45% макс.</div>
    </div>
  );
}
