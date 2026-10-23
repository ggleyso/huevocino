import crypto from 'node:crypto';

export interface Card {
  suit: number; // 0♠ 1♥ 2♦ 3♣
  rank: number; // 0=2 … 9=T, 10=J, 11=Q, 12=K, 13=A
}

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export function makeShoe(decks = 6): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 0; rank <= 12; rank++) cards.push({ suit, rank });
    }
  }
  return cards;
}

export function shuffle<T>(arr: T[], rng: () => number = () => crypto.randomInt(1_000_000) / 1_000_000): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- блэкджек ----

export function blackjackValue(hand: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 12) {
      aces += 1;
      total += 11;
    } else if (c.rank >= 8) total += 10;
    else total += c.rank + 2;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && blackjackValue(hand).total === 21;
}

export function cardLabel(c: Card): string {
  return `${RANKS[c.rank]}${SUITS[c.suit]}`;
}

// ---- покер: 5 карт ----

export type PokerHandType =
  | 'high'
  | 'pair'
  | 'twoPair'
  | 'trips'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'quads'
  | 'straightFlush';

export interface PokerRank {
  type: PokerHandType;
  kickers: number[]; // по убыванию, для сравнения внутри типа
}

function rankCounts(cards: Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

export function pokerRank(cards: Card[]): PokerRank {
  if (cards.length !== 5) throw new Error('нужно ровно 5 карт');
  const counts = [...rankCounts(cards).entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(c => c.suit === cards[0].suit);
  const ranksDesc = [...cards.map(c => c.rank)].sort((a, b) => b - a);
  const uniq = [...new Set(ranksDesc)];
  let straight = false;
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) {
      straight = true;
      straightHigh = uniq[0];
    } else if (uniq[0] === 12 && uniq[1] === 3 && uniq[2] === 2 && uniq[3] === 1 && uniq[4] === 0) {
      straight = true;
      straightHigh = 3; // A-2-3-4-5, старшая 5
    }
  }

  if (straight && flush) return { type: 'straightFlush', kickers: [straightHigh] };
  if (counts[0][1] === 4) return { type: 'quads', kickers: [counts[0][0], counts[1][0]] };
  if (counts[0][1] === 3 && counts[1][1] === 2) return { type: 'fullHouse', kickers: [counts[0][0], counts[1][0]] };
  if (flush) return { type: 'flush', kickers: ranksDesc };
  if (straight) return { type: 'straight', kickers: [straightHigh] };
  if (counts[0][1] === 3) return { type: 'trips', kickers: [counts[0][0], counts[1][0], counts[2][0]] };
  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const pairs = [counts[0][0], counts[1][0]].sort((a, b) => b - a);
    return { type: 'twoPair', kickers: [pairs[0], pairs[1], counts[2][0]] };
  }
  if (counts[0][1] === 2) {
    const rest = counts.slice(1).map(c => c[0]).sort((a, b) => b - a);
    return { type: 'pair', kickers: [counts[0][0], ...rest] };
  }
  return { type: 'high', kickers: ranksDesc };
}

export function comparePoker(a: PokerRank, b: PokerRank): number {
  const order: PokerHandType[] = ['high', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush'];
  const d = order.indexOf(a.type) - order.indexOf(b.type);
  if (d !== 0) return Math.sign(d);
  const n = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < n; i++) {
    const ka = a.kickers[i] ?? 0;
    const kb = b.kickers[i] ?? 0;
    if (ka !== kb) return Math.sign(ka - kb);
  }
  return 0;
}

export const POKER_HAND_NAMES: Record<PokerHandType, string> = {
  high: 'Старшая карта',
  pair: 'Пара',
  twoPair: 'Две пары',
  trips: 'Тройка',
  straight: 'Стрит',
  flush: 'Флеш',
  fullHouse: 'Фулл-хаус',
  quads: 'Каре',
  straightFlush: 'Стрит-флеш',
};

// дилер квалифицируется с Q-high или лучше
export function dealerQualifies(hand: Card[]): boolean {
  const r = pokerRank(hand);
  if (r.type !== 'high') return true;
  return r.kickers[0] >= 10; // Q=10, K=11, A=12
}
