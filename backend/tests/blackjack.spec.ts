import { describe, it, expect } from 'vitest';
import { Store } from '../src/store.js';
import { BlackjackGame } from '../src/games/blackjack.js';
import type { Card } from '../src/games/cards.js';

// кодировка: 0=2 … 7=9, 8=T, 9=J, 10=Q, 11=K, 12=A
const R = (rank: number, suit = 0): Card => ({ suit, rank });

// shoe.pop() берёт с конца: массив = [последняя карта первой раздачи, …, первая]
// порядок раздачи: p1 p2 d1 d2 (+ добор дилера при стенде, + дабл-карта)
function makeGame(deck: Card[]) {
  const store = new Store();
  const g = new BlackjackGame(store);
  const shoe = [...deck];
  (g as any).draw = () => {
    if (shoe.length === 0) shoe.push(R(0));
    return shoe.pop();
  };
  return { store, g };
}

describe('блэкджек', () => {
  it('раздача списывает ставку, 21 на старте = блэкджек 3:2', () => {
    // pop: A(p1) K(p2) T(d1) 6(d2) → у игрока блэкджек, у дилера 16
    const { store, g } = makeGame([R(4), R(8), R(11), R(12)]);
    const v = g.deal('device:dev', 100);
    expect(v.result).toBe('blackjack');
    expect(v.payout).toBe(250); // ставка 100 + 150 (3:2)
    expect(store.player('device:dev').balance).toBe(1000 - 100 + 250);
  });

  it('перебор игрока = проигрыш', () => {
    // pop: K(p1) 9(p2)=19, 6(d1) 5(d2), добор Q → 29
    const { store, g } = makeGame([R(3), R(4), R(7), R(11), R(10)]);
    g.deal('device:dev', 100);
    const v = g.hit('device:dev');
    expect(v.result).toBe('lose');
    expect(v.payout).toBe(0);
    expect(store.player('device:dev').balance).toBe(900);
  });

  it('хит до 21 не завершает раздачу, стенд работает', () => {
    // p: 5+6=11, d: 6+T=16, добора нет: хитим 7 → 18, стенд → дилер добирает 5 → 21
    const { g } = makeGame([R(3), R(4), R(8), R(4), R(3), R(5)]);
    g.deal('device:dev', 100);
    const v1 = g.hit('device:dev');
    expect(v1.state).toBe('playing');
    expect(v1.playerTotal).toBe(18);
    const v2 = g.stand('device:dev');
    expect(v2.dealerTotal).toBe(21);
    expect(v2.result).toBe('lose');
  });

  it('дабл: ставка ×2, одна карта, выплата по итогу', () => {
    // p: 5+6=11, d: T+9=19, дабл-карта 9 → 20 > 19
    const { store, g } = makeGame([R(7), R(7), R(8), R(4), R(3)]);
    g.deal('device:dev', 100);
    const v = g.double('device:dev');
    expect(v.bet).toBe(200);
    expect(v.result).toBe('win');
    expect(v.payout).toBe(400);
    expect(store.player('device:dev').balance).toBe(1000 - 200 + 400);
  });

  it('дабл без монет — отказ', () => {
    const { store, g } = makeGame([R(7), R(7), R(8), R(4), R(3)]);
    store.player('device:dev').balance = 150;
    g.deal('device:dev', 100);
    expect(() => g.double('device:dev')).toThrowError('Недостаточно монет');
  });

  it('нельзя хитить после завершения; новый раунд разрешён', () => {
    const { g } = makeGame([R(7), R(7), R(8), R(4), R(3), R(0), R(1), R(2), R(3), R(4), R(5)]);
    g.deal('device:dev', 100);
    const v = g.stand('device:dev');
    expect(v.state).toBe('done');
    expect(() => g.hit('device:dev')).toThrowError('Действие недоступно');
    expect(() => g.deal('device:dev', 100)).not.toThrow();
  });

  it('недостаточно монет на ставку', () => {
    const { store, g } = makeGame([R(4), R(8), R(11), R(12)]);
    store.player('device:dev').balance = 50;
    expect(() => g.deal('device:dev', 100)).toThrowError('Недостаточно монет');
  });

  it('оба блэкджека → push (ставка возвращается)', () => {
    // p: K+A, d: K+A
    const { store, g } = makeGame([R(12), R(11), R(12), R(11)]);
    const v = g.deal('device:dev', 100);
    expect(v.result).toBe('push');
    expect(v.payout).toBe(100);
    expect(store.player('device:dev').balance).toBe(1000);
  });

  it('дилер в переборе → победа игрока', () => {
    // p: 9+8=17, d: K+9=19? нет — дилер: K+6=16 добирает Q → 26 перебор
    const { store, g } = makeGame([R(10), R(4), R(7), R(6), R(5)]);
    g.deal('device:dev', 100); // p 9+8? pop: 5? считаем: pop R(5)=7(p1), R(6)=8(p2)=15, R(4)=6(d1), R(7)=9(d2)=15, добор R(10)=Q дилер=25
    const v = g.stand('device:dev');
    expect(v.dealerTotal).toBeGreaterThan(21);
    expect(v.result).toBe('win');
    expect(store.player('device:dev').balance).toBe(1100);
  });
});
