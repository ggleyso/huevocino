import { describe, it, expect } from 'vitest';
import { Store, BONUS_AMOUNT, BONUS_COOLDOWN_MS } from '../src/store.js';

describe('ежедневный бонус', () => {
  it('первый забор выдаёт бонус, повторный — ошибка', () => {
    const store = new Store();
    const id = 'device:dev';
    const before = store.player(id).balance;

    const first = store.claimBonus(id, 1_000_000);
    expect(first.ok).toBe(true);
    expect(first.balance).toBe(before + BONUS_AMOUNT);
    expect(first.nextTs).toBe(1_000_000 + BONUS_COOLDOWN_MS);

    const second = store.claimBonus(id, 1_000_000 + 60_000);
    expect(second.ok).toBe(false);
    expect(second.balance).toBe(before + BONUS_AMOUNT);
    expect(second.nextTs).toBe(1_000_000 + BONUS_COOLDOWN_MS);
  });

  it('после кулдауна бонус доступен снова', () => {
    const store = new Store();
    const id = 'device:dev';
    store.claimBonus(id, 1_000_000);

    const early = store.claimBonus(id, 1_000_000 + BONUS_COOLDOWN_MS - 1);
    expect(early.ok).toBe(false);

    const later = store.claimBonus(id, 1_000_000 + BONUS_COOLDOWN_MS);
    expect(later.ok).toBe(true);
    expect(later.balance).toBe(1000 + BONUS_AMOUNT * 2);
  });

  it('bonusState отражает готовность', () => {
    const store = new Store();
    const id = 'device:dev';

    const before = store.bonusState(id, 5_000_000);
    expect(before.ready).toBe(true);

    store.claimBonus(id, 5_000_000);
    const after = store.bonusState(id, 5_000_000 + 10);
    expect(after.ready).toBe(false);
    expect(after.nextTs).toBe(5_000_000 + BONUS_COOLDOWN_MS);

    const nextDay = store.bonusState(id, 5_000_000 + BONUS_COOLDOWN_MS);
    expect(nextDay.ready).toBe(true);
  });
});
