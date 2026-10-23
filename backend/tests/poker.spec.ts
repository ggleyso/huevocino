import { describe, it, expect } from 'vitest';
import { Store } from '../src/store.js';
import { PokerGame } from '../src/games/poker.js';
import type { Card } from '../src/games/cards.js';

// кодировка: 0=2 … 7=9, 8=T, 9=J, 10=Q, 11=K, 12=A
const R = (rank: number, suit = 0): Card => ({ suit, rank });
// рука из рангов с РАЗНЫМИ мастями (иначе 5 одинаковых мастей = флеш)
const H = (ranks: number[]): Card[] => ranks.map((r, i) => R(r, i % 4));

// раздача: игроку 5, потом дилеру 5 — ригсим draw очередью
function rigged(player: number[], dealer: number[]) {
  const store = new Store();
  const g = new PokerGame(store);
  const queue = [...H(player), ...H(dealer)];
  let i = 0;
  (g as any).draw = () => queue[i++];
  return { store, g };
}

describe('покер против дилера', () => {
  it('анте списывается, дилер показывает одну карту, повторная раздача запрещена', () => {
    const { g } = rigged([12, 11, 7, 3, 1], [10, 6, 3, 1, 0]);
    const v = g.ante('device:dev', 100);
    expect(v.state).toBe('decision');
    expect(v.canCall).toBe(true);
    expect(v.callCost).toBe(200);
    expect(v.dealer.length).toBe(1);
    expect(v.dealerUp).toBeTruthy();
    expect(() => g.ante('device:dev', 100)).toThrowError('Раунд ещё идёт');
  });

  it('фолд: теряешь только анте', () => {
    const { store, g } = rigged([12, 11, 7, 3, 1], [10, 6, 3, 1, 0]);
    g.ante('device:dev', 100);
    const v = g.decide('device:dev', 'fold');
    expect(v.result).toBe('lose');
    expect(v.payout).toBe(0);
    expect(store.player('device:dev').balance).toBe(900);
    expect(store.player('device:dev').gameStats.poker).toMatchObject({ rounds: 1, wagered: 100, won: 0 });
  });

  it('дилер не квалифицировался (J-high): анте 1:1, колл возврат', () => {
    // игрок A-high, дилер J-high
    const { store, g } = rigged([12, 11, 7, 3, 1], [9, 7, 3, 1, 0]);
    g.ante('device:dev', 100);
    const v = g.decide('device:dev', 'call');
    expect(v.dealerQualified).toBe(false);
    expect(v.playerHand).toBe('Старшая карта');
    expect(v.dealerHand).toBe('Старшая карта');
    expect(v.result).toBe('win');
    expect(v.payout).toBe(400); // анте 100×2 + колл 200 назад
    expect(store.player('device:dev').balance).toBe(1000 - 100 - 200 + 400);
  });

  it('игрок бьёт квалифицированного дилера: анте+колл 1:1', () => {
    // игрок: пара тузов; дилер: Q-high
    const { store, g } = rigged([12, 12, 7, 3, 1], [10, 6, 3, 1, 0]);
    g.ante('device:dev', 100);
    const v = g.decide('device:dev', 'call');
    expect(v.dealerQualified).toBe(true);
    expect(v.result).toBe('win');
    expect(v.playerHand).toBe('Пара');
    expect(v.dealerHand).toBe('Старшая карта');
    expect(v.payout).toBe(600); // ставки 300 + профит 300
    expect(store.player('device:dev').balance).toBe(1000 - 300 + 600);
  });

  it('дилер сильнее: всё сгорает', () => {
    // игрок J-high; дилер: пара двоек
    const { store, g } = rigged([9, 7, 5, 3, 1], [0, 0, 7, 3, 1]);
    g.ante('device:dev', 100);
    const v = g.decide('device:dev', 'call');
    expect(v.dealerQualified).toBe(true);
    expect(v.playerHand).toBe('Старшая карта');
    expect(v.dealerHand).toBe('Пара');
    expect(v.result).toBe('lose');
    expect(v.payout).toBe(0);
    expect(store.player('device:dev').balance).toBe(700);
  });

  it('ничьи руки → возврат ставок', () => {
    // обе K-high одинаковые
    const { store, g } = rigged([11, 7, 5, 3, 1], [11, 7, 5, 3, 1]);
    g.ante('device:dev', 100);
    const v = g.decide('device:dev', 'call');
    expect(v.result).toBe('push');
    expect(v.payout).toBe(300);
    expect(store.player('device:dev').balance).toBe(1000);
  });

  it('колл без монет (2×анте) — отказ, фолд доступен', () => {
    const { store, g } = rigged([12, 11, 7, 3, 1], [10, 6, 3, 1, 0]);
    store.player('device:dev').balance = 150;
    g.ante('device:dev', 100);
    expect(() => g.decide('device:dev', 'call')).toThrowError('Недостаточно монет для колла');
    expect(() => g.decide('device:dev', 'fold')).not.toThrow();
  });

  it('статистика растёт после победы', () => {
    const { store, g } = rigged([12, 12, 7, 3, 1], [10, 6, 3, 1, 0]);
    g.ante('device:dev', 100);
    g.decide('device:dev', 'call');
    expect(store.player('device:dev').gameStats.poker).toMatchObject({ rounds: 1, wins: 1, wagered: 300, won: 600 });
  });
});
