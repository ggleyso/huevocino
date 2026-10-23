import { describe, it, expect } from 'vitest';
import { validateName, Store } from '../src/store.js';

describe('смена имени игрока', () => {
  it('валидация имён', () => {
    expect(validateName('Пилот-77')).toBe(null);
    expect(validateName('Космонавт 1')).toBe(null);
    expect(validateName('  ok_name  ')).toBe(null);

    expect(validateName('ab')).toBe('Имя от 3 символов');
    expect(validateName('a'.repeat(17))).toBe('Имя до 16 символов');
    expect(validateName('bad<name>')).toBeTruthy();
    expect(validateName('имя;drop')).toBeTruthy();
    expect(validateName('')).toBeTruthy();
  });

  it('имя сохраняется в сторе', () => {
    const store = new Store();
    const id = 'device:dev';
    const before = store.player(id).name;
    store.player(id).name = 'Капитан';
    store.save();
    expect(store.player(id).name).toBe('Капитан');
    expect(before).not.toBe('Капитан');
  });
});
