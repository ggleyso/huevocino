import crypto from 'node:crypto';
import type { Store } from '../store.js';
import { makeShoe, shuffle, pokerRank, dealerQualifies, comparePoker, POKER_HAND_NAMES, type Card, type PokerRank } from './cards.js';

export type PokerState = 'decision' | 'done';

export interface PokerSession {
  ante: number;
  player: Card[];
  dealer: Card[];
  state: PokerState;
  folded?: boolean;
  called?: boolean;
  result?: 'win' | 'lose' | 'push';
  payout?: number;
  playerRank?: PokerRank;
  dealerRank?: PokerRank;
  dealerQualified?: boolean;
  note?: string;
}

export interface PokerView {
  ante: number;
  player: Card[];
  dealer: Card[];
  dealerUp: Card | null;
  state: PokerState;
  canFold: boolean;
  canCall: boolean;
  callCost: number;
  playerHand: string | null;
  dealerHand: string | null;
  dealerQualified: boolean | null;
  result: PokerSession['result'];
  payout: number;
  stake: number;
  note: string;
}

export class PokerGame {
  private sessions = new Map<string, PokerSession>();
  private deck: Card[] = [];

  constructor(
    private store: Store,
    private rng: () => number = Math.random,
  ) {}

  private draw(): Card {
    if (this.deck.length < 20) this.deck = shuffle(makeShoe(1), this.rng);
    return this.deck.pop()!;
  }

  ante(identity: string, bet: number): PokerView {
    const existing = this.sessions.get(identity);
    if (existing && existing.state !== 'done') throw new Error('Раунд ещё идёт');
    const player = this.store.player(identity);
    const err = this.store.validateBet(player.balance, bet);
    if (err) throw new Error(err);
    player.balance -= bet;
    this.store.save();

    const session: PokerSession = {
      ante: bet,
      player: [this.draw(), this.draw(), this.draw(), this.draw(), this.draw()],
      dealer: [this.draw(), this.draw(), this.draw(), this.draw(), this.draw()],
      state: 'decision',
    };
    this.sessions.set(identity, session);
    return this.view(session);
  }

  decide(identity: string, action: 'fold' | 'call'): PokerView {
    const s = this.sessions.get(identity);
    if (!s || s.state !== 'decision') throw new Error('Нет активной раздачи');
    const player = this.store.player(identity);

    if (action === 'fold') {
      s.folded = true;
      s.state = 'done';
      s.result = 'lose';
      s.payout = 0;
      s.note = 'Сдался — анте сгорает';
      this.stats(identity, s, 0, false);
      this.store.save();
      return this.view(s);
    }

    const callCost = s.ante * 2;
    if (player.balance < callCost) throw new Error('Недостаточно монет для колла (2×анте)');
    player.balance -= callCost;
    s.called = true;
    s.state = 'done';

    const pr = pokerRank(s.player);
    const dr = pokerRank(s.dealer);
    const qualified = dealerQualifies(s.dealer);
    s.playerRank = pr;
    s.dealerRank = dr;
    s.dealerQualified = qualified;
    s.payout = 0;

    const cmp = comparePoker(pr, dr);
    if (!qualified) {
      // дилер не квалифицировался: анте выигрывает, колл — возврат
      s.result = 'win';
      s.payout = s.ante * 2 + callCost;
      s.note = `У дилера ${POKER_HAND_NAMES[dr.type].toLowerCase()} хуже дамы — не сыграл`;
    } else if (cmp > 0) {
      s.result = 'win';
      s.payout = s.ante * 2 + callCost * 2;
      s.note = `${POKER_HAND_NAMES[pr.type]} против ${POKER_HAND_NAMES[dr.type]}`;
    } else if (cmp === 0) {
      s.result = 'push';
      s.payout = s.ante + callCost;
      s.note = 'Ничья — ставки возвращаются';
    } else {
      s.result = 'lose';
      s.payout = 0;
      s.note = `${POKER_HAND_NAMES[dr.type]} против ${POKER_HAND_NAMES[pr.type]}`;
    }

    player.balance += s.payout;
    this.stats(identity, s, s.payout, s.result === 'win');
    this.store.save();
    return this.view(s);
  }

  private stats(identity: string, s: PokerSession, payout: number, win: boolean) {
    const p = this.store.player(identity);
    p.gameStats.poker ??= { rounds: 0, wins: 0, wagered: 0, won: 0 };
    const g = p.gameStats.poker;
    g.rounds = (g.rounds ?? 0) + 1;
    g.wagered = (g.wagered ?? 0) + s.ante + (s.called ? s.ante * 2 : 0);
    g.won = (g.won ?? 0) + payout;
    if (win) g.wins = (g.wins ?? 0) + 1;
  }

  view(s: PokerSession): PokerView {
    const done = s.state === 'done';
    const playerRank = done ? pokerRank(s.player) : null;
    const dealerRank = done ? pokerRank(s.dealer) : null;
    return {
      ante: s.ante,
      player: s.player,
      dealer: done || s.called ? s.dealer : s.dealer.slice(0, 1),
      dealerUp: done ? null : s.dealer[0],
      state: s.state,
      canFold: s.state === 'decision',
      canCall: s.state === 'decision',
      callCost: s.ante * 2,
      playerHand: playerRank ? POKER_HAND_NAMES[playerRank.type] : null,
      dealerHand: dealerRank ? POKER_HAND_NAMES[dealerRank.type] : null,
      dealerQualified: s.dealerQualified ?? null,
      result: s.result,
      payout: s.payout ?? 0,
      stake: s.ante + (s.called ? s.ante * 2 : 0),
      note: s.note ?? '',
    };
  }

  activeView(identity: string): PokerView | null {
    const s = this.sessions.get(identity);
    return s && s.state !== 'done' ? this.view(s) : null;
  }

  viewOf(identity: string): PokerView | null {
    const s = this.sessions.get(identity);
    return s ? this.view(s) : null;
  }

  isActive(identity: string): boolean {
    const s = this.sessions.get(identity);
    return Boolean(s && s.state === 'decision');
  }

  clear(identity: string) {
    this.sessions.delete(identity);
  }
}
