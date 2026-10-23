import { useEffect, useState } from 'react';
import { fmt } from '../api';
import { useGame } from '../store';
import { sfx } from '../sound';
import { fetchArcadeList, useArcade, useBet, type ArcadeApi } from './arcade/useArcade';
import { DiceGame, CoinGame, WheelGame, PenaltyGame, HorsesGame } from './arcade/gamesLuck';
import { MinesGame, LadderGame, ChickenGame, KenoGame, TicTacToeGame } from './arcade/gamesGrid';
import { VideoPokerGame, BaccaratGame, WarGame, HiloGame, RedDogGame } from './arcade/gamesCards';
import type { ArcadeMeta, ArcadeState } from '../types';

const GAME_COMPONENTS: Record<string, (p: { api: ArcadeApi; bet: number; setBet: (n: number) => void }) => JSX.Element> = {
  dice: DiceGame,
  coin: CoinGame,
  wheel: WheelGame,
  mines: MinesGame,
  videopoker: VideoPokerGame,
  baccarat: BaccaratGame,
  war: WarGame,
  hilo: HiloGame,
  penalty: PenaltyGame,
  horses: HorsesGame,
  tictactoe: TicTacToeGame,
  ladder: LadderGame,
  chicken: ChickenGame,
  reddog: RedDogGame,
  keno: KenoGame,
};

const TAGS = ['Все', 'Шанс', 'Риск', 'Карты', 'Серия', 'ИИ', 'Лотерея', 'Гонка'];

function GameView({ meta, onBack }: { meta: ArcadeMeta; onBack: () => void }) {
  const api = useArcade(meta.id);
  const { bet, setBet } = useBet(100);
  const Comp = GAME_COMPONENTS[meta.id];

  return (
    <div className="game-page">
      <div className="page-head">
        <button className="btn-ghost arcade-back" onClick={() => { sfx.click(); onBack(); }}>
          ← Все игры
        </button>
        <h2>
          {meta.icon} {meta.name}
        </h2>
        <span className="balance-pill">🪙 {fmt(api.balance)}</span>
      </div>
      {Comp ? <Comp api={api} bet={bet} setBet={setBet} /> : <div className="muted-text">Игра в разработке</div>}
    </div>
  );
}

export function ArcadePage() {
  const [games, setGames] = useState<ArcadeMeta[]>([]);
  const [balance, setBalance] = useState(0);
  const [active, setActive] = useState<ArcadeMeta | null>(null);
  const [tag, setTag] = useState('Все');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchArcadeList();
        setGames(r.games);
        setBalance(r.balance);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!active) {
      void (async () => {
        try {
          const r = await fetchArcadeList();
          setBalance(r.balance);
        } catch {
          /* ignore */
        }
      })();
    }
  }, [active]);

  if (active) {
    return <GameView meta={active} onBack={() => setActive(null)} />;
  }

  const shown = tag === 'Все' ? games : games.filter(g => g.tag === tag);

  return (
    <div className="game-page">
      <div className="page-head">
        <h2>🎮 Аркада — 15 игр</h2>
        <span className="balance-pill">🪙 {fmt(balance)}</span>
      </div>

      {err && (
        <div className="err-banner" onClick={() => setErr(null)}>
          {err}
        </div>
      )}

      <div className="arcade-filters">
        {TAGS.map(t => (
          <button key={t} className={`slot-tab${tag === t ? ' on' : ''}`} onClick={() => { sfx.click(); setTag(t); }}>
            {t}
          </button>
        ))}
      </div>

      <div className="arcade-grid">
        {shown.map((g, i) => (
          <button
            key={g.id}
            className="arcade-card"
            style={{ animationDelay: `${i * 0.03}s` }}
            onClick={() => { sfx.click(); setActive(g); }}
          >
            <span className="arcade-card-icon">{g.icon}</span>
            <span className="arcade-card-name">{g.name}</span>
            <span className="arcade-card-desc">{g.desc}</span>
            <span className="arcade-card-tag">{g.tag}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && !err && <div className="muted-text text-center">Нет игр в этой категории</div>}

      <div className="hint text-center">
        Все 15 игр используют общий баланс HuEVOCINO. Монеты — внутриигровая валюта, реальных денег нет.
      </div>

      {balance < 10 && (
        <div className="panel flex items-center justify-between" style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>Монет не хватает на ставки</span>
          <button className="btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => useGame.getState().setWallet(true)}>
            Пополнить
          </button>
        </div>
      )}
    </div>
  );
}

export type { ArcadeState };
