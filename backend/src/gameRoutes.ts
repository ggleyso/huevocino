import { Router } from 'express';
import type { Store } from './store.js';
import { auth } from './middleware.js';
import { BlackjackGame } from './games/blackjack.js';
import { SlotsGame, SLOTS } from './games/slots.js';
import { PokerGame } from './games/poker.js';
import { ArcadeRegistry } from './games/arcade/index.js';
import { SeatMap } from './seats.js';
import { leaderboard } from './leaderboard.js';

const TABLE_CAP = 4;

export function gameRoutes(store: Store): Router {
  const r = Router();
  const blackjack = new BlackjackGame(store);
  const slots = new SlotsGame(store);
  const poker = new PokerGame(store);
  const arcade = new ArcadeRegistry(store);
  const bjSeats = new SeatMap(TABLE_CAP);
  const pkSeats = new SeatMap(TABLE_CAP);

  const nameOf = (identity: string) => store.player(identity).name;

  const bjSeatList = (me: string) => {
    bjSeats.evict(id => blackjack.isActive(id));
    return bjSeats.list().map(s => ({
      name: s.name,
      me: s.identity === me,
      joinedAt: s.joinedAt,
      hand: blackjack.viewOf(s.identity),
    }));
  };

  const pkSeatList = (me: string) => {
    pkSeats.evict(id => poker.isActive(id));
    return pkSeats.list().map(s => ({
      name: s.name,
      me: s.identity === me,
      joinedAt: s.joinedAt,
      hand: poker.viewOf(s.identity),
    }));
  };

  const wrap =
    (fn: (req: any, res: any) => void) =>
    (req: any, res: any) => {
      try {
        fn(req, res);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    };

  // ---- блэкджек ----
  r.get('/blackjack/state', auth, (req, res) => {
    const id = req.identity;
    if (blackjack.viewOf(id)) bjSeats.heartbeat(id, nameOf(id));
    res.json({
      active: blackjack.activeView(id),
      balance: store.player(id).balance,
      seats: bjSeatList(id),
      cap: TABLE_CAP,
    });
  });

  r.post('/blackjack/join', auth, wrap((req, res) => {
    bjSeats.ensure(req.identity, nameOf(req.identity), id => blackjack.isActive(id));
    res.json({ ok: true, seats: bjSeatList(req.identity), cap: TABLE_CAP });
  }));

  r.post('/blackjack/leave', auth, wrap((req, res) => {
    if (blackjack.isActive(req.identity)) throw new Error('Заверши раздачу, прежде чем встать');
    blackjack.clear(req.identity);
    bjSeats.leave(req.identity);
    res.json({ ok: true, seats: bjSeatList(req.identity), cap: TABLE_CAP });
  }));

  r.post('/blackjack/deal', auth, wrap((req, res) => {
    bjSeats.ensure(req.identity, nameOf(req.identity), id => blackjack.isActive(id));
    const bet = Number(req.body?.bet);
    res.json({
      view: blackjack.deal(req.identity, bet),
      balance: store.player(req.identity).balance,
      seats: bjSeatList(req.identity),
      cap: TABLE_CAP,
    });
  }));

  r.post('/blackjack/hit', auth, wrap((req, res) => {
    res.json({ view: blackjack.hit(req.identity), balance: store.player(req.identity).balance, seats: bjSeatList(req.identity) });
  }));

  r.post('/blackjack/stand', auth, wrap((req, res) => {
    res.json({ view: blackjack.stand(req.identity), balance: store.player(req.identity).balance, seats: bjSeatList(req.identity) });
  }));

  r.post('/blackjack/double', auth, wrap((req, res) => {
    res.json({ view: blackjack.double(req.identity), balance: store.player(req.identity).balance, seats: bjSeatList(req.identity) });
  }));

  // ---- слоты ----
  r.get('/slots', auth, (_req, res) => {
    res.json({
      slots: Object.values(SLOTS).map(s => ({
        id: s.id,
        name: s.name,
        symbols: s.symbols,
        lines: s.lines,
        wild: s.wild,
        scatter: s.scatter,
        icon: s.symbols[s.scatter],
        frame: s.frame,
      })),
      balance: store.player(_req.identity).balance,
    });
  });

  r.post('/slots/:id/spin', auth, wrap((req, res) => {
    const bet = Number(req.body?.bet);
    res.json({ ...slots.spin(req.identity, String(req.params.id), bet), balance: store.player(req.identity).balance });
  }));

  // ---- покер ----
  r.get('/poker/state', auth, (req, res) => {
    const id = req.identity;
    if (poker.viewOf(id)) pkSeats.heartbeat(id, nameOf(id));
    res.json({
      active: poker.activeView(id),
      balance: store.player(id).balance,
      seats: pkSeatList(id),
      cap: TABLE_CAP,
    });
  });

  r.post('/poker/join', auth, wrap((req, res) => {
    pkSeats.ensure(req.identity, nameOf(req.identity), id => poker.isActive(id));
    res.json({ ok: true, seats: pkSeatList(req.identity), cap: TABLE_CAP });
  }));

  r.post('/poker/leave', auth, wrap((req, res) => {
    if (poker.isActive(req.identity)) throw new Error('Заверши раздачу, прежде чем встать');
    poker.clear(req.identity);
    pkSeats.leave(req.identity);
    res.json({ ok: true, seats: pkSeatList(req.identity), cap: TABLE_CAP });
  }));

  r.post('/poker/ante', auth, wrap((req, res) => {
    pkSeats.ensure(req.identity, nameOf(req.identity), id => poker.isActive(id));
    const bet = Number(req.body?.bet);
    res.json({
      view: poker.ante(req.identity, bet),
      balance: store.player(req.identity).balance,
      seats: pkSeatList(req.identity),
      cap: TABLE_CAP,
    });
  }));

  r.post('/poker/decide', auth, wrap((req, res) => {
    const action = String(req.body?.action || '');
    if (action !== 'fold' && action !== 'call') throw new Error('Нужно fold или call');
    res.json({ view: poker.decide(req.identity, action), balance: store.player(req.identity).balance, seats: pkSeatList(req.identity) });
  }));

  // ---- аркада: 15 игр ----
  r.get('/arcade', auth, (req, res) => {
    res.json({ games: arcade.list(), balance: store.player(req.identity).balance });
  });

  r.get('/arcade/:id/state', auth, wrap((req, res) => {
    const game = arcade.get(String(req.params.id));
    res.json({ view: game.view(req.identity), balance: store.player(req.identity).balance });
  }));

  r.post('/arcade/:id', auth, wrap((req, res) => {
    const game = arcade.get(String(req.params.id));
    const action = String(req.body?.action || '');
    const view = game.act(req.identity, action, req.body ?? {});
    res.json({ view, balance: store.player(req.identity).balance });
  }));

  // ---- лидерборд ----
  r.get('/leaderboard', auth, (req, res) => {
    res.json(leaderboard(store, req.identity));
  });

  return r;
}
