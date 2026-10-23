import { describe, it, expect, beforeAll } from 'vitest';
import { Store } from '../src/store.js';
import { leaderboard } from '../src/leaderboard.js';

describe('лидерборд', () => {
  const store = new Store();

  beforeAll(() => {
    store.seedDemoPlayers();
    store.player('device:aaaa').balance = 50000; // выше всех демо
    store.player('device:bbbb').balance = 500;
  });

  it('демо-игроки засеяны один раз', () => {
    const demo = Object.values(store.data.players).filter(p => p.demo);
    expect(demo.length).toBeGreaterThanOrEqual(8);
    const count = Object.values(store.data.players).filter(p => p.demo).length;
    store.seedDemoPlayers();
    expect(Object.values(store.data.players).filter(p => p.demo).length).toBe(count);
  });

  it('сортировка по балансу, свой ранг виден', () => {
    const lb = leaderboard(store, 'device:aaaa');
    expect(lb.rows[0].name).toBe('Пилот-AAAA');
    expect(lb.rows[0].self).toBe(true);
    expect(lb.rows[0].balance).toBe(50000);
    expect(lb.selfRank).toBe(1);
    for (let i = 1; i < lb.rows.length; i++) {
      expect(lb.rows[i].balance).toBeLessThanOrEqual(lb.rows[i - 1].balance);
    }
    expect(lb.total).toBe(Object.keys(store.data.players).length);
  });

  it('демо-строки помечены, limit работает', () => {
    const lb = leaderboard(store, 'device:bbbb', 5);
    expect(lb.rows).toHaveLength(5);
    expect(lb.rows.some(r => r.demo)).toBe(true);
    expect(lb.rows.every(r => 'rank' in r && 'name' in r)).toBe(true);
    expect(lb.selfRank).toBeGreaterThan(5); // device:bbbb низко
  });
});
