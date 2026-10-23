import { fmt } from '../../api';
import { useGame } from '../../store';
import { PlayingCard } from '../../components/PlayingCard';
import { BET_PRESETS } from './useArcade';
import type { ReactNode } from 'react';

export interface GameProps {
  api: import('./useArcade').ArcadeApi;
  bet: number;
  setBet: (n: number) => void;
}

export function BetBar({
  bet,
  setBet,
  balance,
  disabled,
  children,
}: {
  bet: number;
  setBet: (n: number) => void;
  balance: number;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const step = (dir: 1 | -1) => {
    const st = bet >= 1000 ? 100 : bet >= 100 ? 50 : 10;
    setBet(Math.min(Math.max(bet + dir * st, 10), Math.min(Math.max(balance, 10), 100000)));
  };
  return (
    <div className="arcade-bet">
      <div className="arcade-bet-presets">
        {BET_PRESETS.map(p => (
          <button key={p} className={`btn-ghost${bet === p ? ' btn-on' : ''}`} disabled={disabled || p > balance} onClick={() => setBet(p)}>
            {fmt(p)}
          </button>
        ))}
        <button className="btn-ghost" disabled={disabled} onClick={() => setBet(Math.max(10, balance))}>
          Макс
        </button>
      </div>
      <div className="arcade-bet-row">
        <button className="round-btn mini" disabled={disabled || bet <= 10} onClick={() => step(-1)}>
          −
        </button>
        <div className="bet-val">
          <span className="hud-label">Ставка</span>
          <b>{fmt(bet)} 🪙</b>
        </div>
        <button className="round-btn mini" disabled={disabled || bet >= balance} onClick={() => step(1)}>
          +
        </button>
        {children}
      </div>
    </div>
  );
}

export function ArcadeResult({ win, text, amount }: { win: boolean | null; text: string; amount?: number }) {
  if (win === null) return null;
  return (
    <div className={`arcade-result${win ? ' win' : ' lose'}`}>
      {text}
      {amount !== undefined && amount > 0 ? <> +{fmt(amount)} 🪙</> : null}
    </div>
  );
}

export function UseWalletButton() {
  return (
    <button className="btn-ghost" onClick={() => useGame.getState().setWallet(true)}>
      Пополнить
    </button>
  );
}

export function CardRow({ cards, small }: { cards: ({ suit: number; rank: number } | null)[]; small?: boolean }) {
  return (
    <div className="cards-line">
      {cards.map((c, i) => (
        <PlayingCard key={i} card={c} small={small} />
      ))}
    </div>
  );
}
