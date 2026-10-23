import { useState } from 'react';
import { fmt } from '../../api';
import { useGame } from '../../store';
import { sfx } from '../../sound';
import { BetBar, ArcadeResult, type GameProps } from './shared';

function Idle({ text }: { text: string }) {
  return <div className="arcade-idle">{text}</div>;
}

// ---------- 🎲 Кости ----------
export function DiceGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const [target, setTarget] = useState(50);
  const [dir, setDir] = useState<'gt' | 'lt'>('gt');
  const last = view?.last as { roll: number; win: boolean; payout: number; mult: number; target: number; dir: string } | null;
  const chance = dir === 'gt' ? 100 - target : target;
  const mult = 97 / chance;

  const roll = async () => {
    if (busy || bet > balance) return;
    sfx.spin();
    await act('roll', { bet, target, dir });
    const v = (api.view?.last as { win: boolean } | null) ?? null;
    if (v) v.win ? sfx.win(false) : sfx.lose();
  };

  return (
    <div className="arcade-game">
      <div className="dice-stage">
        <div className={`dice-number${last ? (last.win ? ' win' : ' lose') : ''}`}>{last ? last.roll : '—'}</div>
        <div className="dice-gauge">
          <div className={`dice-fill ${dir}`} style={{ width: `${chance}%` }} />
          <div className="dice-marker" style={{ left: `${target}%` }} />
        </div>
        <div className="flex justify-between text-xs muted-text">
          <span>шанс {chance}%</span>
          <span>множитель ×{mult.toFixed(2)}</span>
        </div>
        <input className="dice-slider" type="range" min={2} max={98} value={target} disabled={busy} onChange={e => setTarget(Number(e.target.value))} />
        <div className="flex gap-2">
          <button className={`btn-ghost ${dir === 'lt' ? 'btn-on' : ''}`} style={{ flex: 1 }} onClick={() => setDir('lt')} disabled={busy}>
            ↓ Ниже {target}
          </button>
          <button className={`btn-ghost ${dir === 'gt' ? 'btn-on' : ''}`} style={{ flex: 1 }} onClick={() => setDir('gt')} disabled={busy}>
            ↑ Выше {target}
          </button>
        </div>
        <ArcadeResult win={last ? last.win : null} text={last?.win ? 'ВЫИГРЫШ' : 'МИМО'} amount={last?.payout} />
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
      <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
        <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={roll}>
          {busy ? '…' : 'БРОСОК'}
        </button>
      </BetBar>
      {balance < 10 && <button className="btn-ghost" onClick={() => useGame.getState().setWallet(true)}>Пополнить кошелёк</button>}
    </div>
  );
}

// ---------- 🪙 Монетка ----------
export function CoinGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const last = view?.last as { result: string; pick: string; win: boolean; payout: number } | null;
  const [spin, setSpin] = useState(false);
  const [flip, setFlip] = useState<string | null>(null);

  const go = async (side: 'heads' | 'tails') => {
    if (busy || bet > balance) return;
    setSpin(true);
    sfx.flip();
    await act('flip', { bet, side });
    setSpin(false);
    const v = api.view?.last as { win: boolean } | null;
    if (v) v.win ? sfx.win(false) : sfx.lose();
  };

  return (
    <div className="arcade-game">
      <div className="coin-stage">
        <div className={`coin ${spin ? 'spinning' : ''} ${(flip ?? last?.result) === 'tails' ? 'tails' : ''}`}>
          <div className="coin-face">🪙</div>
        </div>
        <div className="coin-label">{last ? (last.result === 'heads' ? 'ОРЁЛ' : 'РЕШКА') : 'Орёл или решка?'}</div>
        <ArcadeResult win={last ? last.win : null} text={last?.result === last?.pick ? 'УГАДАЛ' : 'НЕ УГАДАЛ'} amount={last?.payout} />
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
      <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
        <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={() => go('heads')}>
          ОРЁЛ
        </button>
        <button className="btn-cashout" style={{ flex: 1, animation: 'none', padding: '14px 10px' }} disabled={busy || bet > balance || bet < 10} onClick={() => go('tails')}>
          РЕШКА
        </button>
      </BetBar>
      <div className="hint text-center">Победа платит ×1.94 от ставки.</div>
      {balance < 10 && <button className="btn-ghost" onClick={() => useGame.getState().setWallet(true)}>Пополнить кошелёк</button>}
    </div>
  );
}

// ---------- 🎡 Колесо фортуны ----------
export function WheelGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const segs = (view?.segs as { m: number; w: number }[] | undefined) ?? [];
  const last = view?.last as { index: number; m: number; payout: number } | null;
  const [rot, setRot] = useState(0);

  const spin = async () => {
    if (busy || bet > balance) return;
    sfx.spin();
    await act('spin', { bet });
    const v = api.view?.last as { index: number; m: number; payout: number } | null;
    if (v) {
      // сектора шли по кругу — докручиваем к нужному
      setRot(r => r + 1440 + (360 - (v.index * 360) / Math.max(1, segs.length)) - (r % 360));
      v.payout > 0 ? sfx.win(v.m >= 5) : sfx.lose();
    }
  };

  const total = segs.reduce((a, s) => a + s.w, 0) || 1;
  let acc = 0;
  const conic = segs
    .map((s, i) => {
      const from = (acc / total) * 360;
      acc += s.w;
      const to = (acc / total) * 360;
      const color = s.m === 0 ? '#2a1218' : s.m < 1.5 ? '#7a1e28' : s.m < 3 ? '#c22634' : s.m < 10 ? '#ff4d5e' : s.m < 30 ? '#ffb02e' : '#ffe082';
      return `${color} ${from}deg ${to}deg`;
    })
    .join(', ');

  return (
    <div className="arcade-game">
      <div className="wheel-stage">
        <div className="wheel-pointer">▼</div>
        <div className="wheel-disc" style={{ background: `conic-gradient(${conic})`, transform: `rotate(${rot}deg)` }}>
          <div className="wheel-hub">HuEVO</div>
        </div>
        <ArcadeResult win={last ? last.payout > 0 : null} text={last ? `Сектор ×${last.m}` : 'Крути колесо'} amount={last?.payout} />
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
      <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
        <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={spin}>
          {busy ? 'КРУТИТСЯ…' : 'КРУТИТЬ'}
        </button>
      </BetBar>
      <div className="hint text-center">Сектора от ×0 до ×100 — золотые редкие, но щедрые.</div>
      {balance < 10 && <button className="btn-ghost" onClick={() => useGame.getState().setWallet(true)}>Пополнить кошелёк</button>}
    </div>
  );
}

// ---------- ⚽ Пенальти ----------
const PEN_MULT = [0, 1.45, 2.18, 3.27, 4.91, 7.36];
const DIR_LABEL: Record<string, string> = { left: '← Лево', center: '● Центр', right: 'Право →' };

export function PenaltyGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;
  const goals = (view?.goals as number | undefined) ?? 0;
  const history = (view?.history as { dir: string; keeper: string; scored: boolean }[] | undefined) ?? [];
  const result = view?.result as string | null | undefined;
  const payout = (view?.payout as number | undefined) ?? 0;
  const mult = (view?.mult as number | undefined) ?? PEN_MULT[goals];

  if (phase !== 'play' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="penalty-stage idle">
          <div className="penalty-goal">🥅</div>
          <div className="penalty-text">5 ударов. В каждом вратарь бросается навстречу — угадай угол и забей!</div>
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={() => void act('start', { bet })}>
            НАЧАТЬ СЕРИЮ
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  return (
    <div className="arcade-game">
      <div className="penalty-stage">
        <div className="penalty-score">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`penalty-ball ${i < goals ? 'ok' : i < history.length ? 'miss' : ''}`}>
              {i < goals ? '⚽' : i < history.length ? '✕' : '○'}
            </span>
          ))}
        </div>
        <div className="penalty-mult">×{mult.toFixed(2)} · {fmt(Math.floor(bet * mult))} 🪙</div>
        {history.length > 0 && (
          <div className="penalty-log">
            {history.map((h, i) => (
              <span key={i} className={h.scored ? 'ok' : 'miss'}>
                {DIR_LABEL[h.dir]} {h.scored ? '⚽ ГОЛ' : '✕ сейв'} (вратарь {DIR_LABEL[h.keeper]})
              </span>
            ))}
          </div>
        )}
        {phase === 'done' && (
          <ArcadeResult win={result !== 'lose'} text={result === 'lose' ? 'ПРОМАХ!' : result === 'win' ? 'СЕРИЯ ВЗЯТА!' : 'ЗАБРАНО'} amount={payout} />
        )}
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
      {phase === 'play' ? (
        <>
          <div className="arcade-actions">
            {(['left', 'center', 'right'] as const).map(d => (
              <button key={d} className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => { sfx.flip(); void act('shoot', { dir: d }); }}>
                {DIR_LABEL[d]}
              </button>
            ))}
          </div>
          <div className="arcade-actions">
            <button className="btn-cashout" style={{ width: '100%', animation: 'none', padding: 14 }} disabled={busy || goals === 0} onClick={() => void act('cashout')}>
              ЗАБРАТЬ {fmt(Math.floor(bet * mult))} 🪙
            </button>
          </div>
        </>
      ) : (
        <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void act('start', { bet })}>
          НОВАЯ СЕРИЯ
        </button>
      )}
      <div className="hint text-center">Голы: ×1.45 → ×2.18 → ×3.27 → ×4.91 → ×7.36. Промах — ставка сгорает.</div>
    </div>
  );
}

// ---------- 🏇 Скачки ----------
export function HorsesGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const horses = (view?.horses as { name: string; p: number; emoji: string; odds: number }[] | undefined) ?? [];
  const last = view?.last as { winner: number; win: boolean; payout: number; odds: number } | null;
  const [pick, setPick] = useState(0);
  const [running, setRunning] = useState(false);

  const race = async () => {
    if (busy || bet > balance) return;
    setRunning(true);
    sfx.tick();
    await act('race', { bet, horse: pick });
    setRunning(false);
    const v = api.view?.last as { win: boolean } | null;
    if (v) v.win ? sfx.win(true) : sfx.lose();
  };

  return (
    <div className="arcade-game">
      <div className="horse-list">
        {horses.map((h, i) => (
          <button key={i} className={`horse-card${pick === i ? ' on' : ''}${last?.winner === i ? ' winner' : ''}`} disabled={busy} onClick={() => setPick(i)}>
            <span className="horse-emoji">{h.emoji}</span>
            <span className="horse-name">{h.name}</span>
            <span className="horse-odds">×{h.odds}</span>
            <span className="horse-chance">{Math.round(h.p * 100)}%</span>
            {last?.winner === i && <span className={`horse-tag ${last.win ? 'win' : 'lose'}`}>{last.win ? 'ПОБЕДА' : 'ФИНИШ'}</span>}
          </button>
        ))}
      </div>
      <ArcadeResult win={last ? last.win : null} text={last?.win ? `${horses[last.winner]?.name} ФИНИРУЕТ ПЕРВЫМ` : last ? `${horses[last.winner]?.name} оказался быстрее` : ''} amount={last?.payout} />
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
        <button className="btn-primary" style={{ flex: 1 }} disabled={busy || running || bet > balance || bet < 10} onClick={race}>
          {running ? 'ГОНКА…' : `СТАВКА НА «${horses[pick]?.name ?? '—'}»`}
        </button>
      </BetBar>
      <div className="hint text-center">Коэффициент = 0.96 / шанс победы. Редкие лошади платят больше.</div>
      {balance < 10 && <button className="btn-ghost" onClick={() => useGame.getState().setWallet(true)}>Пополнить кошелёк</button>}
    </div>
  );
}

export { Idle };
