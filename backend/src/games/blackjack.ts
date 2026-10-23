import type { Store } from '../store.js';
import { makeShoe, shuffle, blackjackValue, isBlackjack, type Card } from './cards.js';

export type BlackjackState = 'playing' | 'dealer' | 'done';

export interface BlackjackSession {
  bet: number;
  player: Card[];
  dealer: Card[];
  state: BlackjackState;
  doubled: boolean;
  result?: 'win' | 'lose' | 'push' | 'blackjack';
  payout?: number;
  dealerTotal?: number;
}

export interface BlackjackView {
  bet: number;
  player: Card[];
  playerTotal: number;
  dealer: Card[];
  dealerUp: Card | null;
  dealerTotal: number | null;
  state: BlackjackState;
  doubled: boolean;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  result: BlackjackSession['result'];
  payout: number;
}

const MAX_SHOE_CARDS = 60;

export class BlackjackGame {
  private sessions = new Map<string, BlackjackSession>();
  private shoe: Card[] = [];

  constructor(
    private store: Store,
    private rng: () => number = Math.random,
  ) {}

  private draw(): Card {
    if (this.shoe.length < MAX_SHOE_CARDS) this.shoe = shuffle(makeShoe(6), this.rng);
    return this.shoe.pop()!;
  }

  private takeBet(identity: string, bet: number): void {
    const player = this.store.player(identity);
    const err = this.store.validateBet(player.balance, bet);
    if (err) throw new Error(err);
    player.balance -= bet;
    this.store.save();
  }

  deal(identity: string, bet: number): BlackjackView {
    const existing = this.sessions.get(identity);
    if (existing && existing.state !== 'done') throw new Error('Раунд ещё идёт');
    this.takeBet(identity, bet);

    const session: BlackjackSession = {
      bet,
      player: [this.draw(), this.draw()],
      dealer: [this.draw(), this.draw()],
      state: 'playing',
      doubled: false,
    };
    this.sessions.set(identity, session);

    if (isBlackjack(session.player)) {
      this.finish(identity, session);
    }
    return this.view(session);
  }

  hit(identity: string): BlackjackView {
    const s = this.mustSession(identity);
    if (s.state !== 'playing') throw new Error('Действие недоступно');
    s.player.push(this.draw());
    if (blackjackValue(s.player).total > 21) {
      this.finish(identity, s);
    } else if (blackjackValue(s.player).total === 21) {
      this.standInternal(s);
      this.finish(identity, s);
    }
    return this.view(s);
  }

  double(identity: string): BlackjackView {
    const s = this.mustSession(identity);
    if (s.state !== 'playing' || s.player.length !== 2) throw new Error('Дабл доступен только на первых двух картах');
    const player = this.store.player(identity);
    if (player.balance < s.bet) throw new Error('Недостаточно монет для дабла');
    player.balance -= s.bet;
    s.bet *= 2;
    s.doubled = true;
    this.store.save();
    s.player.push(this.draw());
    if (blackjackValue(s.player).total > 21) {
      this.finish(identity, s);
      return this.view(s);
    }
    this.standInternal(s);
    this.finish(identity, s);
    return this.view(s);
  }

  stand(identity: string): BlackjackView {
    const s = this.mustSession(identity);
    if (s.state !== 'playing') throw new Error('Действие недоступно');
    this.standInternal(s);
    this.finish(identity, s);
    return this.view(s);
  }

  private standInternal(s: BlackjackSession) {
    s.state = 'dealer';
    while (blackjackValue(s.dealer).total < 17) s.dealer.push(this.draw());
  }

  private finish(identity: string, s: BlackjackSession) {
    const player = this.store.player(identity);
    const p = blackjackValue(s.player);
    const d = blackjackValue(s.dealer);
    s.dealerTotal = d.total;
    s.state = 'done';

    let result: NonNullable<BlackjackSession['result']>;
    let payout = 0;

    if (p.total > 21) {
      result = 'lose';
    } else if (s.player.length === 2 && isBlackjack(s.player) && !s.doubled) {
      if (isBlackjack(s.dealer)) {
        result = 'push';
        payout = s.bet;
      } else {
        result = 'blackjack';
        payout = Math.floor(s.bet * 2.5); // 3:2
      }
    } else if (d.total > 21) {
      result = 'win';
      payout = s.bet * 2;
    } else if (p.total > d.total) {
      result = 'win';
      payout = s.bet * 2;
    } else if (p.total === d.total) {
      result = 'push';
      payout = s.bet;
    } else {
      result = 'lose';
    }

    s.result = result;
    s.payout = payout;
    player.balance += payout;

    const gs = this.gs(identity);
    gs.rounds = (gs.rounds ?? 0) + 1;
    gs.wagered = (gs.wagered ?? 0) + s.bet;
    gs.won = (gs.won ?? 0) + payout;
    gs.wins = (gs.wins ?? 0) + (result === 'win' || result === 'blackjack' ? 1 : 0);
    this.store.save();
    this.sessions.set(identity, s);
  }

  private gs(identity: string) {
    const p = this.store.player(identity);
    p.gameStats.blackjack ??= { rounds: 0, wins: 0, wagered: 0, won: 0 };
    return p.gameStats.blackjack;
  }

  private mustSession(identity: string): BlackjackSession {
    const s = this.sessions.get(identity);
    if (!s) throw new Error('Нет активной раздачи');
    return s;
  }

  view(s: BlackjackSession): BlackjackView {
    const p = blackjackValue(s.player);
    const d = blackjackValue(s.dealer);
    const done = s.state === 'done';
    return {
      bet: s.bet,
      player: s.player,
      playerTotal: p.total,
      dealer: done || s.state === 'dealer' ? s.dealer : s.dealer.slice(0, 1),
      dealerUp: done || s.state === 'dealer' ? null : s.dealer[0],
      dealerTotal: done ? d.total : null,
      state: s.state,
      doubled: s.doubled,
      canHit: s.state === 'playing',
      canStand: s.state === 'playing',
      canDouble: s.state === 'playing' && s.player.length === 2 && !s.doubled,
      result: s.result,
      payout: s.payout ?? 0,
    };
  }

  activeView(identity: string): BlackjackView | null {
    const s = this.sessions.get(identity);
    return s && s.state !== 'done' ? this.view(s) : null;
  }

  viewOf(identity: string): BlackjackView | null {
    const s = this.sessions.get(identity);
    return s ? this.view(s) : null;
  }

  isActive(identity: string): boolean {
    const s = this.sessions.get(identity);
    return Boolean(s && s.state !== 'done');
  }

  clear(identity: string) {
    this.sessions.delete(identity);
  }
}
