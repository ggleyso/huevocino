import type { Store } from '../../store.js';
import type { ArcadeGame, ArcadeMeta } from './common.js';
import { takeBet, settle, num } from './common.js';
import { DiceGame, CoinGame, WheelGame, PenaltyGame, HorsesGame } from './luck.js';
import { MinesGame, LadderGame, ChickenGame, KenoGame, TicTacToeGame } from './grids.js';
import { VideoPokerGame, BaccaratGame, WarGame, HiloGame, RedDogGame } from './cards.js';

export type { ArcadeGame, ArcadeMeta } from './common.js';

export class ArcadeRegistry {
  private games = new Map<string, ArcadeGame>();

  constructor(private store: Store) {
    for (const g of [
      new DiceGame(store),
      new CoinGame(store),
      new WheelGame(store),
      new MinesGame(store),
      new VideoPokerGame(store),
      new BaccaratGame(store),
      new WarGame(store),
      new HiloGame(store),
      new PenaltyGame(store),
      new HorsesGame(store),
      new TicTacToeGame(store),
      new LadderGame(store),
      new ChickenGame(store),
      new RedDogGame(store),
      new KenoGame(store),
    ]) {
      this.games.set(g.meta.id, g);
    }
  }

  list(): ArcadeMeta[] {
    return [...this.games.values()].map(g => g.meta);
  }

  get(id: string): ArcadeGame {
    const g = this.games.get(id);
    if (!g) throw new Error('Такой игры нет');
    return g;
  }
}

export { takeBet, settle, num };
