import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store.js';
import { RoundManager, RoundError } from '../src/rounds.js';

function makeRounds(opts?: { crashAt?: number; now?: () => number }) {
  const store = new Store();
  let fakeNow = opts?.now ?? (() => 1_000_000);
  const scheduled: { fn: () => void; ms: number }[] = [];
  const rounds = new RoundManager(store, {
    now: () => fakeNow(),
    schedule: (fn, ms) => {
      scheduled.push({ fn, ms });
      return 0 as any;
    },
    cancel: () => {},
    rng: () => opts?.crashAt ?? 3.5,
  });
  return {
    store,
    rounds,
    scheduled,
    setNow: (t: number) => {
      fakeNow = () => t;
    },
  };
}

describe('раунды', () => {
  beforeEach(() => {});

  it('ставка списывается, баланс падает', () => {
    const { store, rounds } = makeRounds();
    const p = store.player('device:dev');
    p.balance = 1000;
    rounds.start('device:dev', 100);
    expect(store.player('device:dev').balance).toBe(900);
  });

  it('второй раунд параллельно запрещён', () => {
    const { rounds } = makeRounds();
    rounds.start('device:dev', 100);
    expect(() => rounds.start('device:dev', 100)).toThrowError(RoundError);
  });

  it('недостаточно монет / ставка вне лимитов', () => {
    const { store, rounds } = makeRounds();
    store.player('device:dev').balance = 50;
    expect(() => rounds.start('device:dev', 100)).toThrowError('Недостаточно монет');
    expect(() => rounds.start('device:dev', 5)).toThrowError('Минимальная ставка 10');
    expect(() => rounds.start('device:dev', 100000)).toThrowError('Недостаточно монет');
    expect(() => rounds.start('device:dev', 100001)).toThrowError('Максимальная ставка 100000');
    expect(() => rounds.start('device:dev', 10.5)).toThrowError('Ставка — целое число');
  });

  it('кэшаут до краша: выплата floor(ставка × множитель), баланс растёт', () => {
    const { store, rounds, setNow } = makeRounds({ crashAt: 10 });
    store.player('device:dev').balance = 1000;
    const round = rounds.start('device:dev', 100);
    setNow(round.startTs + 2800); // множитель = e^1 = 2.71828…
    const res = rounds.cashout(round.id, 'device:dev');
    expect(res.multiplier).toBe(2.71);
    expect(res.payout).toBe(271);
    expect(store.player('device:dev').balance).toBe(900 + 271);
    const h = store.player('device:dev').history[0];
    expect(h.win).toBe(true);
    expect(h.cashoutAt).toBe(2.71);
    expect(h.crashAt).toBeNull();
  });

  it('краш без кэшаута: ставка потеряна, история фиксирует crashAt', () => {
    const { store, rounds } = makeRounds({ crashAt: 1.5 });
    store.player('device:dev').balance = 1000;
    const round = rounds.start('device:dev', 200);
    rounds.fireCrash(round.id);
    expect(store.player('device:dev').balance).toBe(800);
    const h = store.player('device:dev').history[0];
    expect(h.win).toBe(false);
    expect(h.crashAt).toBe(1.5);
    expect(h.payout).toBe(0);
    expect(store.player('device:dev').stats).toMatchObject({ rounds: 1, losses: 1, stake: 200 });
  });

  it('кэшаут после краша → 409', () => {
    const { rounds } = makeRounds({ crashAt: 2 });
    const round = rounds.start('device:dev', 100);
    rounds.fireCrash(round.id);
    expect(() => rounds.cashout(round.id, 'device:dev')).toThrowError('Раунд уже завершён');
  });

  it('чужой/незнакомый игрок не может вывести чужой раунд', () => {
    const { rounds } = makeRounds();
    const round = rounds.start('device:dev', 100);
    expect(() => rounds.cashout(round.id, 'device:other')).toThrowError('Раунд не найден');
    expect(() => rounds.cashout('nope', 'device:dev')).toThrowError('Раунд не найден');
  });

  it('после завершения можно начать новый раунд', () => {
    const { rounds } = makeRounds({ crashAt: 1.2 });
    const r1 = rounds.start('device:dev', 100);
    rounds.fireCrash(r1.id);
    const r2 = rounds.start('device:dev', 100);
    expect(r2.id).not.toBe(r1.id);
  });

  it('подписка получает событие crash', () => {
    const { rounds } = makeRounds({ crashAt: 4 });
    const round = rounds.start('device:dev', 100);
    const events: any[] = [];
    rounds.subscribe(round.id, e => events.push(e));
    rounds.fireCrash(round.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: 'crash', crashAt: 4 });
  });

  it('getActive возвращает активный раунд и null после завершения', () => {
    const { rounds } = makeRounds({ crashAt: 3 });
    expect(rounds.getActive('device:dev')).toBeNull();
    const round = rounds.start('device:dev', 100);
    expect(rounds.getActive('device:dev')?.id).toBe(round.id);
    rounds.fireCrash(round.id);
    expect(rounds.getActive('device:dev')).toBeNull();
  });
});
