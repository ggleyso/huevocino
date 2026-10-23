import type { Card } from '../types';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];

export function PlayingCard({ card, hidden, small }: { card?: Card | null; hidden?: boolean; small?: boolean }) {
  if (hidden || !card) {
    return (
      <div className={`pcard pcard-back${small ? ' pcard-sm' : ''}`} aria-label="рубашка">
        <span className="back-emblem">✦</span>
      </div>
    );
  }
  const red = card.suit === 1 || card.suit === 2;
  const suit = SUITS[card.suit];
  const rank = RANKS[card.rank];
  return (
    <div className={`pcard${small ? ' pcard-sm' : ''} ${red ? 'pcard-red' : 'pcard-black'}`}>
      <span className="pcard-corner top">
        <b>{rank}</b>
        <i>{suit}</i>
      </span>
      <span className="pcard-pip">
        {rank === 'J' || rank === 'Q' || rank === 'K' ? <b className="pcard-fig">{rank}</b> : null}
        <i>{suit}</i>
      </span>
      <span className="pcard-corner bottom">
        <b>{rank}</b>
        <i>{suit}</i>
      </span>
    </div>
  );
}
