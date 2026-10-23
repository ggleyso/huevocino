import { describe, it, expect } from 'vitest';
import { makeShoe, shuffle, blackjackValue, isBlackjack, pokerRank, comparePoker, dealerQualifies, type Card } from '../src/games/cards.js';

// кодировка рангов: 0=2 … 7=9, 8=T, 9=J, 10=Q, 11=K, 12=A
const c = (rank: number, suit = 0): Card => ({ suit, rank });

describe('колода', () => {
  it('башмак 6 колод: 312 карт, без дублей', () => {
    const shoe = makeShoe(6);
    expect(shoe.length).toBe(312);
    const keys = new Set(shoe.map(x => `${x.suit}:${x.rank}`));
    expect(keys.size).toBe(52);
  });

  it('перемешивание не теряет карты', () => {
    const shoe = shuffle(makeShoe(1));
    expect(shoe.length).toBe(52);
    expect(new Set(shoe.map(x => `${x.suit}:${x.rank}`)).size).toBe(52);
  });
});

describe('блэкджек: подсчёт очков', () => {
  it('карты 2-10 по номиналу, TJKQ = 10', () => {
    expect(blackjackValue([c(0), c(0)]).total).toBe(4); // 2+2
    expect(blackjackValue([c(7), c(9)]).total).toBe(19); // 9+J
    expect(blackjackValue([c(10), c(11)]).total).toBe(20); // Q+K
    expect(blackjackValue([c(8), c(8)]).total).toBe(20); // T+T
  });

  it('тузы: 11 пока не перебор, потом 1', () => {
    expect(blackjackValue([c(12), c(8)]).total).toBe(21); // A+T
    expect(blackjackValue([c(12), c(12), c(8)]).total).toBe(12); // A+A+T = 12
    expect(blackjackValue([c(12), c(12), c(12), c(12), c(12)]).total).toBe(15);
    const soft = blackjackValue([c(12), c(5)]); // A+7
    expect(soft.total).toBe(18);
    expect(soft.soft).toBe(true);
    const hard = blackjackValue([c(12), c(5), c(3)]); // A+7+5 = 13
    expect(hard.total).toBe(13);
    expect(hard.soft).toBe(false);
  });

  it('перебор > 21', () => {
    expect(blackjackValue([c(11), c(11), c(11)]).total).toBe(30); // K+K+K
  });

  it('блэкджек = 2 карты на 21', () => {
    expect(isBlackjack([c(12), c(8)])).toBe(true); // A+T
    expect(isBlackjack([c(12), c(5), c(10)])).toBe(false); // 21 тремя
  });
});

describe('покер: ранги рук', () => {
  const hand = (...ranks: number[]): Card[] => ranks.map((r, i) => c(r, i % 4));

  it('порядок типов: старшая < пара < ... < стрит-флеш', () => {
    const high = pokerRank(hand(12, 11, 9, 7, 5)); // A K J 9 7
    const pair = pokerRank(hand(7, 7, 12, 11, 5));
    const twoPair = pokerRank(hand(7, 7, 5, 5, 12));
    const trips = pokerRank(hand(7, 7, 7, 12, 11));
    const straight = pokerRank(hand(2, 3, 4, 5, 6));
    const flush = pokerRank([c(0, 1), c(3, 1), c(6, 1), c(9, 1), c(12, 1)]);
    const full = pokerRank(hand(7, 7, 7, 5, 5));
    const quads = pokerRank(hand(7, 7, 7, 7, 12));
    const sf = pokerRank([c(3, 2), c(4, 2), c(5, 2), c(6, 2), c(7, 2)]);
    const order = [high, pair, twoPair, trips, straight, flush, full, quads, sf];
    for (let i = 0; i < order.length - 1; i++) {
      expect(comparePoker(order[i], order[i + 1])).toBeLessThan(0);
      expect(comparePoker(order[i + 1], order[i])).toBeGreaterThan(0);
    }
  });

  it('сравнение внутри типа: кикеры решают', () => {
    expect(comparePoker(pokerRank(hand(12, 11, 9, 7, 5)), pokerRank(hand(11, 10, 9, 7, 5)))).toBeGreaterThan(0); // A>K старшая
    expect(comparePoker(pokerRank(hand(7, 7, 12, 11, 5)), pokerRank(hand(7, 7, 11, 10, 5)))).toBeGreaterThan(0); // пара с тузом
    expect(comparePoker(pokerRank(hand(7, 7, 7, 12, 11)), pokerRank(hand(7, 7, 7, 12, 11)))).toBe(0);
  });

  it('стрит A-2-3-4-5 (колесо) старшая 5; T-J-Q-K-A старшая туз', () => {
    expect(pokerRank(hand(0, 1, 2, 3, 12))).toMatchObject({ type: 'straight', kickers: [3] });
    expect(pokerRank(hand(8, 9, 10, 11, 12))).toMatchObject({ type: 'straight', kickers: [12] });
  });

  it('квалификация дилера: Q-high и лучше', () => {
    expect(dealerQualifies(hand(10, 6, 4, 2, 0))).toBe(true); // Q-high
    expect(dealerQualifies(hand(9, 6, 4, 2, 0))).toBe(false); // J-high
    expect(dealerQualifies(hand(12, 6, 4, 2, 0))).toBe(true); // A-high
    expect(dealerQualifies(hand(7, 7, 12, 11, 5))).toBe(true); // пара
  });
});
