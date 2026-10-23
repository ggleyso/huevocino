import { useState } from 'react';
import { fmt } from '../../api';
import { useGame } from '../../store';
import { sfx } from '../../sound';
import { PlayingCard } from '../../components/PlayingCard';
import { BetBar, ArcadeResult, type GameProps } from './shared';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];

function rankLabel(rank: number): string {
  return RANKS[rank] ?? '?';
}

// ---------- 🃏 Видеопокер ----------
export function VideoPokerGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;
  const hand = view?.hand as { suit: number; rank: number }[] | undefined;
  const drawn = Boolean(view?.drawn);
  const payout = (view?.payout as number | undefined) ?? 0;
  const resultName = view?.resultName as string | null | undefined;
  const [holds, setHolds] = useState<boolean[]>([false, false, false, false, false]);

  const deal = async () => {
    setHolds([false, false, false, false, false]);
    sfx.deal();
    await act('deal', { bet });
  };

  const doDraw = async () => {
    sfx.flip();
    await act('draw', { holds });
    const v = api.view as { payout?: number; resultName?: string } | null;
    if (v && (v.payout ?? 0) > 0) sfx.win((v.payout ?? 0) >= bet * 3);
    else sfx.lose();
  };

  if (phase !== 'play' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="felt">
          <div className="cards-line">
            {[0, 1, 2, 3, 4].map(i => (
              <PlayingCard key={i} hidden />
            ))}
          </div>
          <div className="poker-note">Jacks or Better: пара валетов+ возвращает ставку, роял-флеш ×250</div>
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={deal}>
            СДАТЬ
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  return (
    <div className="arcade-game">
      <div className="felt">
        <div className="cards-line">
          {hand?.map((c, i) => (
            <button key={i} className={`vp-hold${holds[i] ? ' on' : ''}`} disabled={busy || drawn} onClick={() => { sfx.click(); setHolds(h => h.map((v, j) => (j === i ? !v : v))); }}>
              <PlayingCard card={c} />
              <span className="vp-hold-label">{holds[i] ? 'ОСТАВИТЬ' : 'ЗАБРАТЬ'}</span>
            </button>
          ))}
        </div>
        {drawn && <div className={`result-banner ${payout > 0 ? 'result-win' : 'result-lose'}`}>{resultName} {payout > 0 ? `+${fmt(payout)} 🪙` : ''}</div>}
      </div>
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      {!drawn ? (
        <div className="arcade-actions">
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={doDraw}>
            ЗАМЕНИТЬ НЕОТМЕЧЕННЫЕ
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => setHolds([true, true, true, true, true])}>
            ВСЕ 5
          </button>
        </div>
      ) : (
        <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={deal}>
          НОВАЯ РАЗДАЧА
        </button>
      )}
      <div className="hint text-center">Пейтейбл: пара ×1 · две пары ×2 · тройка ×3 · стрит ×4 · флеш ×6 · фулл ×9 · каре ×25 · стрит-флеш ×50 · роял ×250</div>
    </div>
  );
}

// ---------- 🀄 Баккара ----------
export function BaccaratGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;
  const done = phase === 'done';

  const deal = async (on: 'player' | 'banker' | 'tie') => {
    sfx.deal();
    await act('deal', { bet, on });
    const v = api.view as { outcome?: string; on?: string; payout?: number } | null;
    if (v) (v.outcome === v.on || (v.payout ?? 0) > 0) ? sfx.winCards() : sfx.loseCards();
  };

  if (!done) {
    return (
      <div className="arcade-game">
        <div className="felt">
          <div className="felt-row">
            <span className="felt-label">Выбери сторону</span>
          </div>
          <div className="baccarat-picks">
            <button className="bc-pick player" disabled={busy || bet > balance || bet < 10} onClick={() => void deal('player')}>
              <b>ИГРОК</b>
              <span>×1.00</span>
            </button>
            <button className="bc-pick tie" disabled={busy || bet > balance || bet < 10} onClick={() => void deal('tie')}>
              <b>НИЧЬЯ</b>
              <span>×8</span>
            </button>
            <button className="bc-pick banker" disabled={busy || bet > balance || bet < 10} onClick={() => void deal('banker')}>
              <b>БАНК</b>
              <span>×0.95</span>
            </button>
          </div>
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy} />
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  const outcome = view?.outcome as string;
  const on = view?.on as string;
  const payout = (view?.payout as number | undefined) ?? 0;
  const playerTotal = view?.playerTotal as number;
  const bankerTotal = view?.bankerTotal as number;
  const win = on === outcome || payout > 0;

  return (
    <div className="arcade-game">
      <div className="felt">
        <div className="felt-row">
          <span className="felt-label">Игрок · {playerTotal}</span>
          <div className="cards-line">{(view?.player as { suit: number; rank: number }[]).map((c, i) => <PlayingCard key={i} card={c} />)}</div>
        </div>
        <div className={`result-banner ${win ? 'result-win' : 'result-lose'}`}>
          {outcome === 'tie' ? 'НИЧЬЯ' : outcome === 'player' ? 'ВЫИГРАЛ ИГРОК' : 'ВЫИГРАЛ БАНК'}
          {payout > 0 ? ` +${fmt(payout)} 🪙` : payout === (view?.bet as number) && on !== outcome ? ' — ставка возвращена' : ''}
        </div>
        <div className="felt-row">
          <span className="felt-label">Банк · {bankerTotal}</span>
          <div className="cards-line">{(view?.banker as { suit: number; rank: number }[]).map((c, i) => <PlayingCard key={i} card={c} />)}</div>
        </div>
      </div>
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void act('deal', { bet, on })}>
        ЕЩЁ РАЗДАЧА
      </button>
      <div className="hint text-center">Третья карта по правилам баккары. Ставка на ничью возвращается, если она не сыграла.</div>
    </div>
  );
}

// ---------- ⚔️ Война ----------
export function WarGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const done = view?.phase === 'done';

  const draw = async () => {
    sfx.deal();
    await act('draw', { bet });
    const v = api.view as { result?: string } | null;
    if (v) v.result === 'win' ? sfx.winCards() : v.result === 'push' ? sfx.push() : sfx.loseCards();
  };

  if (!done) {
    return (
      <div className="arcade-game">
        <div className="felt">
          <div className="cards-line">
            <PlayingCard hidden />
            <PlayingCard hidden />
          </div>
          <div className="poker-note">Твоя карта против карты дилера. Старше — выигрыш ×1.96. Ничья — война!</div>
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={draw}>
            ВЫКИНУТЬ КАРТЫ
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  const player = view?.player as { suit: number; rank: number };
  const dealer = view?.dealer as { suit: number; rank: number };
  const war = Boolean(view?.war);
  const playerWar = view?.playerWar as { suit: number; rank: number } | undefined;
  const dealerWar = view?.dealerWar as { suit: number; rank: number } | undefined;
  const result = view?.result as string;
  const payout = (view?.payout as number | undefined) ?? 0;

  return (
    <div className="arcade-game">
      <div className="felt">
        <div className="felt-row">
          <span className="felt-label">Дилер</span>
          <div className="cards-line">
            <PlayingCard card={dealer} />
            {war && dealerWar && <PlayingCard card={dealerWar} />}
          </div>
        </div>
        <div className={`result-banner result-${result}`}>
          {result === 'win' ? (war ? 'ВОЙНА ВЫИГРАНА!' : 'ТЫ СТАРШЕ') : result === 'push' ? 'НИЧЬЯ ВОЙНЫ — ВОЗВРАТ' : 'ДИЛЕР СТАРШЕ'}
          {payout > 0 ? ` +${fmt(payout)} 🪙` : ''}
        </div>
        <div className="felt-row">
          <span className="felt-label">Ты {war && playerWar ? '· вторая карта' : ''}</span>
          <div className="cards-line">
            <PlayingCard card={player} />
            {war && playerWar && <PlayingCard card={playerWar} />}
          </div>
        </div>
      </div>
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={draw}>
        НОВЫЙ БОЙ
      </button>
    </div>
  );
}

// ---------- 🔮 Хай-Ло ----------
export function HiloGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;

  const start = async () => {
    sfx.deal();
    await act('start', { bet });
  };

  const guess = async (g: 'higher' | 'lower') => {
    sfx.flip();
    await act('guess', { guess: g });
    const v = api.view as { result?: string } | null;
    if (v?.result === 'lose') sfx.lose();
    else sfx.win(false);
  };

  if (phase !== 'play' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="felt">
          <div className="cards-line">
            <PlayingCard hidden />
          </div>
          <div className="poker-note">Угадай, будет ли следующая карта выше или ниже. Множитель растёт с каждым шагом — можно забрать в любой момент.</div>
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={start}>
            НАЧАТЬ
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  const current = view?.current as { suit: number; rank: number };
  const step = (view?.step as number | undefined) ?? 0;
  const max = (view?.max as number | undefined) ?? 6;
  const mult = (view?.mult as number | undefined) ?? 1;
  const nextMult = view?.nextMult as number | null | undefined;
  const result = view?.result as string | null | undefined;
  const payout = (view?.payout as number | undefined) ?? 0;
  const done = phase === 'done';
  const red = current.suit === 1 || current.suit === 2;

  return (
    <div className="arcade-game">
      <div className="felt">
        <div className="hilo-meta">
          <span>ход {step}/{max}</span>
          <b className="gold">×{mult.toFixed(2)} · {fmt(Math.floor(bet * mult))} 🪙</b>
        </div>
        <div className="cards-line">
          <div className={`hilo-card${red ? ' red' : ''}`}>
            <PlayingCard card={current} />
            <div className="hilo-suit">{SUITS[current.suit]} {rankLabel(current.rank)}</div>
          </div>
        </div>
        {done && <div className={`result-banner ${result === 'lose' ? 'result-lose' : 'result-win'}`}>{result === 'lose' ? 'НЕ УГАДАЛ — СТАВКА СГОРЕЛА' : result === 'max' ? 'МАКСИМУМ ДОСТИГНУТ!' : 'ЗАБРАНО'} {payout > 0 ? `+${fmt(payout)} 🪙` : ''}</div>}
      </div>
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      {!done ? (
        <>
          <div className="arcade-actions">
            <button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => void guess('higher')}>
              ↑ ВЫШЕ {nextMult ? `→ ×${nextMult.toFixed(2)}` : ''}
            </button>
            <button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => void guess('lower')}>
              ↓ НИЖЕ {nextMult ? `→ ×${nextMult.toFixed(2)}` : ''}
            </button>
          </div>
          <button className="btn-cashout" style={{ width: '100%', animation: 'none', padding: 14 }} disabled={busy || step === 0} onClick={() => { sfx.cashout(); void act('cashout'); }}>
            ЗАБРАТЬ ×{mult.toFixed(2)}
          </button>
        </>
      ) : (
        <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={start}>
          НОВЫЙ РАУНД
        </button>
      )}
    </div>
  );
}

// ---------- ❤️ Красная собака ----------
export function RedDogGame({ api, bet, setBet }: GameProps) {
  const { view, balance, busy, act, err, clearErr } = api;
  const phase = view?.phase as string | undefined;

  const start = async () => {
    sfx.deal();
    await act('start', { bet });
  };

  if (phase !== 'ready' && phase !== 'done') {
    return (
      <div className="arcade-game">
        <div className="felt">
          <div className="cards-line">
            <PlayingCard hidden />
            <PlayingCard hidden />
          </div>
          <div className="poker-note">Две карты раскладываются — третья должна пасть между ними. Шире спред — щедрее выплата.</div>
        </div>
        <BetBar bet={bet} setBet={setBet} balance={balance} disabled={busy}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy || bet > balance || bet < 10} onClick={start}>
            РАЗЛОЖИТЬ
          </button>
        </BetBar>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      </div>
    );
  }

  const a = view?.a as { suit: number; rank: number };
  const b = view?.b as { suit: number; rank: number };
  const c = view?.c as { suit: number; rank: number } | null;
  const spread = (view?.spread as number | undefined) ?? 0;
  const mult = (view?.mult as number | undefined) ?? 1;
  const result = view?.result as string | null | undefined;
  const payout = (view?.payout as number | undefined) ?? 0;

  if (phase === 'ready') {
    return (
      <div className="arcade-game">
        <div className="felt">
          <div className="cards-line">
            <PlayingCard card={a} />
            <PlayingCard card={b} />
          </div>
          <div className="poker-note">
            Спред <b>{spread}</b> карт — множитель <b className="gold">×{mult.toFixed(2)}</b> · {fmt(Math.floor(bet * mult))} 🪙
          </div>
        </div>
        {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
        <div className="arcade-actions">
          <button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => { sfx.flip(); void act('call'); }}>
            ИГРАТЬ ×{mult.toFixed(2)}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => void act('fold')}>
            Сдаться
          </button>
        </div>
      </div>
    );
  }

  const win = result === 'win';
  const push = result === 'push';
  return (
    <div className="arcade-game">
      <div className="felt">
        <div className="cards-line">
          <PlayingCard card={a} />
          <PlayingCard card={b} />
          {c ? <PlayingCard card={c} /> : <span className="muted-text">перераздача</span>}
        </div>
        <div className={`result-banner ${win ? 'result-win' : push ? 'result-push' : 'result-lose'}`}>
          {push ? 'ПЕРЕРАЗДАЧА — ВОЗВРАТ' : win ? 'МЕЖДУ! ВЫИГРЫШ' : 'НЕ ПОПАЛ'}
          {payout > 0 && payout !== (view?.bet as number) ? ` +${fmt(payout)} 🪙` : push ? '' : ''}
        </div>
      </div>
      {err && <div className="err-banner" onClick={clearErr}>{err}</div>}
      <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={start}>
        НОВАЯ РАЗДАЧА
      </button>
    </div>
  );
}
