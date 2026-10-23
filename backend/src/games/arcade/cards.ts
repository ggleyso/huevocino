import type { Store } from '../../store.js';
import { takeBet, settle, num, type ArcadeGame, type ArcadeMeta } from './common.js';
import { makeShoe, shuffle, pokerRank, POKER_HAND_NAMES, type Card, type PokerHandType } from '../cards.js';

function freshDeck(rng: () => number): Card[] {
  return shuffle(makeShoe(1), rng);
}

function cardRankValue(c: Card): number {
  return c.rank === 0 ? 14 : c.rank + 2; // 2..A=14
}

// ---------- 🃏 Видеопокер (Jacks or Better) ----------
const VP_PAY: Partial<Record<PokerHandType, number>> = {
  pair: 1,
  twoPair: 2,
  trips: 3,
  straight: 4,
  flush: 6,
  fullHouse: 9,
  quads: 25,
  straightFlush: 50,
};
const VP_ROYAL = 250;

interface VPSession {
  bet: number;
  hand: Card[];
  holds: boolean[];
  drawn: boolean;
  deck: Card[];
  payout?: number;
  resultName?: string;
}

function vpEvaluate(hand: Card[]): { mult: number; name: string } {
  const r = pokerRank(hand);
  if (r.type === 'straightFlush' && r.kickers[0] === 12) return { mult: VP_ROYAL, name: 'РОЯЛ-ФЛЕШ' };
  if (r.type === 'pair' && r.kickers[0] >= 8) return { mult: VP_PAY.pair ?? 1, name: 'Пара валетов+' };
  if (r.type === 'straightFlush') return { mult: VP_PAY.straightFlush ?? 50, name: POKER_HAND_NAMES[r.type] };
  if (r.type === 'quads') return { mult: VP_PAY.quads ?? 25, name: POKER_HAND_NAMES[r.type] };
  if (r.type === 'fullHouse') return { mult: VP_PAY.fullHouse ?? 9, name: POKER_HAND_NAMES[r.type] };
  if (r.type === 'flush') return { mult: VP_PAY.flush ?? 6, name: POKER_HAND_NAMES[r.type] };
  if (r.type === 'straight') return { mult: VP_PAY.straight ?? 4, name: POKER_HAND_NAMES[r.type] };
  if (r.type === 'trips') return { mult: VP_PAY.trips ?? 3, name: POKER_HAND_NAMES[r.type] };
  if (r.type === 'twoPair') return { mult: VP_PAY.twoPair ?? 2, name: POKER_HAND_NAMES[r.type] };
  return { mult: 0, name: 'Без выигрыша' };
}

export class VideoPokerGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'videopoker', name: 'Видеопокер', icon: '🎰', desc: 'Jacks or Better: оставляй карты и собери комбинацию', tag: 'Карты' };
  private sessions = new Map<string, VPSession>();
  private rng: () => number;

  constructor(private store: Store, rng: () => number = Math.random) {
    this.rng = rng;
  }

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    return {
      phase: s.drawn ? 'done' : 'play',
      bet: s.bet,
      hand: s.hand,
      drawn: s.drawn,
      payout: s.payout ?? 0,
      resultName: s.resultName ?? null,
      pay: { ...VP_PAY, royal: VP_ROYAL },
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);
    if (action === 'deal') {
      if (s && !s.drawn) throw new Error('Раздача ещё идёт');
      const bet = num(body.bet, 0);
      takeBet(this.store, identity, bet);
      const deck = freshDeck(this.rng);
      const hand = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
      this.sessions.set(identity, { bet, hand, holds: [false, false, false, false, false], drawn: false, deck });
      return this.view(identity);
    }
    if (!s || s.drawn) throw new Error('Нет активной раздачи');
    if (action === 'hold') {
      const holds = Array.isArray(body.holds) ? (body.holds as unknown[]).map(Boolean) : [];
      s.holds = [0, 1, 2, 3, 4].map(i => Boolean(holds[i]));
      this.store.save();
      return this.view(identity);
    }
    if (action === 'draw') {
      if (Array.isArray(body.holds)) {
        const holds = (body.holds as unknown[]).map(Boolean);
        s.holds = [0, 1, 2, 3, 4].map(i => Boolean(holds[i]));
      }
      for (let i = 0; i < 5; i++) {
        if (!s.holds[i]) s.hand[i] = s.deck.pop()!;
      }
      const { mult, name } = vpEvaluate(s.hand);
      const payout = Math.floor(s.bet * mult);
      s.drawn = true;
      s.payout = payout;
      s.resultName = name;
      settle(this.store, identity, 'videopoker', s.bet, payout, payout > 0);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    throw new Error('Неизвестное действие');
  }
}

// ---------- 🀄 Баккара ----------
type BCOutcome = 'player' | 'banker' | 'tie';

function bcTotal(cards: Card[]): number {
  let t = 0;
  for (const c of cards) t += cardRankValue(c) >= 10 ? 0 : cardRankValue(c);
  return t % 10;
}

function bcDeal(rng: () => number): { player: Card[]; banker: Card[] } {
  const deck = freshDeck(rng);
  const player: Card[] = [deck.pop()!, deck.pop()!];
  const banker: Card[] = [deck.pop()!, deck.pop()!];
  let pt = bcTotal(player);
  let bt = bcTotal(banker);
  let pThird: Card | null = null;
  if (pt < 8 && bt < 8) {
    if (pt <= 5) {
      pThird = deck.pop()!;
      player.push(pThird);
      pt = bcTotal(player);
    }
    const pv = pThird ? cardRankValue(pThird) : -1;
    let bankerDraw = false;
    if (!pThird) bankerDraw = bt <= 5;
    else if (bt <= 2) bankerDraw = true;
    else if (bt === 3) bankerDraw = pv !== 8;
    else if (bt === 4) bankerDraw = pv >= 2 && pv <= 7;
    else if (bt === 5) bankerDraw = pv >= 4 && pv <= 7;
    else if (bt === 6) bankerDraw = pv === 6 || pv === 7;
    if (bankerDraw) banker.push(deck.pop()!);
  }
  return { player, banker };
}

interface BCSession {
  bet: number;
  on: BCOutcome;
  player: Card[];
  banker: Card[];
  outcome: BCOutcome;
  payout: number;
}

export class BaccaratGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'baccarat', name: 'Баккара', icon: '🀄', desc: 'Игрок против банка: ставь на сторону или на ничью ×8', tag: 'Карты' };
  private sessions = new Map<string, BCSession>();
  private rng: () => number;

  constructor(private store: Store, rng: () => number = Math.random) {
    this.rng = rng;
  }

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    return {
      phase: 'done',
      bet: s.bet,
      on: s.on,
      player: s.player,
      playerTotal: bcTotal(s.player),
      banker: s.banker,
      bankerTotal: bcTotal(s.banker),
      outcome: s.outcome,
      payout: s.payout,
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'deal') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    const on: BCOutcome = body.on === 'banker' ? 'banker' : body.on === 'tie' ? 'tie' : 'player';
    takeBet(this.store, identity, bet);
    const { player, banker } = bcDeal(this.rng);
    const pt = bcTotal(player);
    const bt = bcTotal(banker);
    const outcome: BCOutcome = pt > bt ? 'player' : bt > pt ? 'banker' : 'tie';
    const mult = outcome === 'tie' ? 8 : outcome === 'player' ? 1 : 0.95;
    const win = outcome === on;
    const payout = win ? Math.floor(bet * mult) : outcome === 'tie' && on !== 'tie' ? bet : 0;
    settle(this.store, identity, 'baccarat', bet, payout, win || payout > 0);
    const session: BCSession = { bet, on, player, banker, outcome, payout };
    this.sessions.set(identity, session);
    return this.view(identity);
  }
}

// ---------- ⚔️ Война ----------
interface WarSession {
  bet: number;
  player: Card;
  dealer: Card;
  war: boolean;
  playerWar?: Card;
  dealerWar?: Card;
  result: 'win' | 'lose' | 'push';
  payout: number;
}

export class WarGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'war', name: 'Война', icon: '⚔️', desc: 'Старшая карта побеждает: война — на внезапной ничьей', tag: 'Карты' };
  private sessions = new Map<string, WarSession>();
  private rng: () => number;

  constructor(private store: Store, rng: () => number = Math.random) {
    this.rng = rng;
  }

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    return { phase: 'done', ...s };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    if (action !== 'draw') throw new Error('Неизвестное действие');
    const bet = num(body.bet, 0);
    takeBet(this.store, identity, bet);
    const deck = freshDeck(this.rng);
    const player = deck.pop()!;
    const dealer = deck.pop()!;
    const pv = cardRankValue(player);
    const dv = cardRankValue(dealer);
    let war = false;
    let playerWar: Card | undefined;
    let dealerWar: Card | undefined;
    let result: WarSession['result'];
    let payout: number;
    if (pv === dv) {
      war = true;
      playerWar = deck.pop()!;
      dealerWar = deck.pop()!;
      const pwv = cardRankValue(playerWar);
      const dwv = cardRankValue(dealerWar);
      if (pwv > dwv) {
        result = 'win';
        payout = Math.floor(bet * 2.5); // война: 1:1 + бонус
      } else if (pwv < dwv) {
        result = 'lose';
        payout = 0;
      } else {
        result = 'push';
        payout = bet;
      }
    } else if (pv > dv) {
      result = 'win';
      payout = Math.floor(bet * 1.96);
    } else {
      result = 'lose';
      payout = 0;
    }
    settle(this.store, identity, 'war', bet, payout, result === 'win');
    const session: WarSession = { bet, player, dealer, war, playerWar, dealerWar, result, payout };
    this.sessions.set(identity, session);
    return this.view(identity);
  }
}

// ---------- 🔮 Хай-Ло ----------
interface HiloSession {
  bet: number;
  deck: Card[];
  current: Card;
  step: number;
  mult: number;
  done: boolean;
  result?: 'cashout' | 'lose' | 'max';
  payout?: number;
}

const HILO_MAX = 6;

export class HiloGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'hilo', name: 'Хай-Ло', icon: '🔮', desc: 'Выше или ниже? Каждый верный ответ — множитель выше', tag: 'Серия' };
  private sessions = new Map<string, HiloSession>();
  private rng: () => number;

  constructor(private store: Store, rng: () => number = Math.random) {
    this.rng = rng;
  }

  private newRound(bet: number): HiloSession {
    const deck = freshDeck(this.rng);
    const current = deck.pop()!;
    return { bet, deck, current, step: 0, mult: 1, done: false };
  }

  private stepMult(step: number): number {
    // растёт с каждым шагом
    return Number((1.35 * Math.pow(1.12, step)).toFixed(2));
  }

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    const cv = cardRankValue(s.current);
    return {
      phase: s.done ? 'done' : 'play',
      bet: s.bet,
      current: s.current,
      currentRank: cv,
      step: s.step,
      max: HILO_MAX,
      mult: s.mult,
      nextMult: s.done ? null : this.stepMult(s.step),
      result: s.result ?? null,
      payout: s.payout ?? 0,
      remaining: s.deck.length,
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);
    if (action === 'start') {
      if (s && !s.done) throw new Error('Раунд уже идёт');
      const bet = num(body.bet, 0);
      takeBet(this.store, identity, bet);
      this.sessions.set(identity, this.newRound(bet));
      return this.view(identity);
    }
    if (!s || s.done) throw new Error('Нет активного раунда');
    if (action === 'cashout') {
      if (s.step === 0) throw new Error('Сделай хотя бы один ход');
      const payout = Math.floor(s.bet * s.mult);
      s.done = true;
      s.result = 'cashout';
      s.payout = payout;
      settle(this.store, identity, 'hilo', s.bet, payout, true);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    if (action === 'guess') {
      const guess = body.guess === 'lower' ? 'lower' : 'higher';
      const next = s.deck.pop();
      if (!next) throw new Error('Колода закончилась');
      const pv = cardRankValue(s.current);
      const nv = cardRankValue(next);
      const correct = guess === 'higher' ? nv > pv : nv < pv;
      if (!correct) {
        s.done = true;
        s.result = 'lose';
        s.payout = 0;
        s.current = next;
        settle(this.store, identity, 'hilo', s.bet, 0, false);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      s.step += 1;
      s.current = next;
      s.mult = this.stepMult(s.step);
      if (s.step >= HILO_MAX) {
        const payout = Math.floor(s.bet * s.mult);
        s.done = true;
        s.result = 'max';
        s.payout = payout;
        settle(this.store, identity, 'hilo', s.bet, payout, true);
        return { ...this.view(identity), balance: this.store.player(identity).balance };
      }
      this.store.save();
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    throw new Error('Неизвестное действие');
  }
}

// ---------- ❤️ Красная собака ----------
interface RedDogSession {
  bet: number;
  a: Card;
  b: Card;
  c: Card | null;
  spread: number;
  phase: 'ready' | 'done';
  result?: 'win' | 'lose' | 'push';
  payout?: number;
}

function rdSpread(a: Card, b: Card): number {
  const x = cardRankValue(a);
  const y = cardRankValue(b);
  return Math.abs(x - y) - 1;
}

export class RedDogGame implements ArcadeGame {
  meta: ArcadeMeta = { id: 'reddog', name: 'Красная собака', icon: '❤️', desc: 'Две карты — угадай, третья ляжет между ними', tag: 'Карты' };
  private sessions = new Map<string, RedDogSession>();
  private rng: () => number;

  constructor(private store: Store, rng: () => number = Math.random) {
    this.rng = rng;
  }

  private payoutMult(spread: number): number {
    if (spread <= 1) return 5;
    if (spread === 2) return 4;
    if (spread <= 4) return 2.5;
    if (spread <= 6) return 1.5;
    return 1.1;
  }

  view(identity: string) {
    const s = this.sessions.get(identity);
    if (!s) return { phase: 'idle' as const };
    return {
      phase: s.phase === 'ready' ? 'ready' : 'done',
      bet: s.bet,
      a: s.a,
      b: s.b,
      c: s.c,
      spread: s.spread,
      mult: this.payoutMult(s.spread),
      result: s.result ?? null,
      payout: s.payout ?? 0,
    };
  }

  act(identity: string, action: string, body: Record<string, unknown>) {
    const s = this.sessions.get(identity);
    if (action === 'start') {
      if (s && s.phase === 'ready') throw new Error('Раунд уже идёт');
      const bet = num(body.bet, 0);
      takeBet(this.store, identity, bet);
      let a: Card, b: Card, spread: number;
      let guard = 0;
      do {
        const deck = freshDeck(this.rng);
        a = deck.pop()!;
        b = deck.pop()!;
        spread = rdSpread(a, b);
      } while (spread <= 0 && guard++ < 50); // равные/смежные — перераздача
      if (spread <= 0) {
        settle(this.store, identity, 'reddog', bet, bet, false);
        this.sessions.set(identity, { bet, a, b, c: null, spread: 0, phase: 'done', result: 'push', payout: bet });
        return this.view(identity);
      }
      this.sessions.set(identity, { bet, a, b, c: null, spread, phase: 'ready' });
      return this.view(identity);
    }
    if (!s || s.phase !== 'ready') throw new Error('Нет активного раунда');
    if (action === 'call') {
      const deck = freshDeck(this.rng);
      const c = deck.pop()!;
      const lo = Math.min(cardRankValue(s.a), cardRankValue(s.b));
      const hi = Math.max(cardRankValue(s.a), cardRankValue(s.b));
      const cv = cardRankValue(c);
      const win = cv > lo && cv < hi;
      const payout = win ? Math.floor(s.bet * this.payoutMult(s.spread)) : 0;
      s.c = c;
      s.phase = 'done';
      s.result = win ? 'win' : 'lose';
      s.payout = payout;
      settle(this.store, identity, 'reddog', s.bet, payout, win);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    if (action === 'fold') {
      s.phase = 'done';
      s.result = 'lose';
      s.payout = 0;
      settle(this.store, identity, 'reddog', s.bet, 0, false);
      return { ...this.view(identity), balance: this.store.player(identity).balance };
    }
    throw new Error('Неизвестное действие');
  }
}
