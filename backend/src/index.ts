import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import rateLimit from 'express-rate-limit';
import { Store, validateName } from './store.js';
import { RoundManager, RoundError } from './rounds.js';
import { auth, requireAdmin } from './middleware.js';
import { huevoConfigured, verifyLaunch, verifyCallbackSignature, huevoApi, issueSession } from './lib/huevo.js';
import { calcCommission, MIN_BET, MAX_BET } from './engine.js';
import { gameRoutes } from './gameRoutes.js';

const app = express();
const PORT = Number(process.env.PORT) || 4200;
const DEV_AUTH = process.env.DEV_AUTH === 'true';

export const store = new Store(process.env.DATA_FILE || 'data.json');
export const rounds = new RoundManager(store);
store.seedDemoPlayers();

app.use(cors());
app.disable('x-powered-by');

// коллбек huEVO — сырое тело для проверки подписи, ДО express.json
app.post('/api/huevo/callback', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!huevoConfigured()) return res.status(503).end();
  const signature = req.get('X-Huevo-Signature') || '';
  if (!verifyCallbackSignature(req.body as Buffer, signature)) return res.status(401).end();

  let event: any;
  try {
    event = JSON.parse((req.body as Buffer).toString('utf8'));
  } catch {
    return res.status(400).end();
  }
  if (event.event !== 'payment') return res.status(204).end();

  if (event.status === 'succeeded' && typeof event.intent_id === 'string') {
    try {
      grantTopup(`huevo:${event.user_id}`, {
        amount: Number(event.amount),
        test: Boolean(event.test),
        intentId: String(event.intent_id),
      });
    } catch (e) {
      console.error('huevo callback grant failed', e);
      return res.status(500).end();
    }
  }
  res.status(204).end();
});

app.use(express.json({ limit: '100kb' }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много запросов' },
  }),
);

function grantTopup(
  identity: string,
  opts: { amount: number; test: boolean; intentId?: string; idemKey?: string },
): { net: number; fee: number; already?: boolean } {
  const { amount, test, intentId, idemKey } = opts;
  if (!Number.isInteger(amount) || amount < 1 || amount > 100_000) throw new RoundError(400, 'Некорректная сумма');

  const player = store.player(identity);
  const key = intentId ? `huevo:${intentId}` : idemKey ? `idem:${idemKey}` : null;
  if (key && player.idem?.key === key) return { net: player.idem.net, fee: player.idem.fee, already: true };

  const { percent, enabled } = store.commission();
  const { fee, net } = calcCommission(amount, percent, enabled);
  player.balance += net;
  store.data.treasury += fee;
  player.topups.unshift({ amount, net, fee, test, intentId, ts: Date.now() });
  player.topups = player.topups.slice(0, 30);
  if (key) player.idem = { key, net, fee };
  store.save();
  return { net, fee };
}

app.get('/health', (_req, res) => res.json({ ok: true, game: 'vzlet' }));

app.post('/api/login', async (req, res) => {
  if (!huevoConfigured()) return res.status(503).json({ error: 'huEVO не настроен: задай HUEVO_CLIENT_ID и HUEVO_CLIENT_SECRET' });
  const query = String(req.body?.query || '');
  if (!query) return res.status(400).json({ error: 'Нет параметров запуска' });

  const launch = verifyLaunch(query);
  if (!launch) return res.status(401).json({ error: 'Неверная подпись huEVO' });

  const huUserId = Number(launch.hu_user_id);
  if (!Number.isInteger(huUserId) || huUserId <= 0) return res.status(401).json({ error: 'Нет hu_user_id' });

  const p = store.player(`huevo:${huUserId}`);
  p.name = launch.hu_username || launch.hu_display_name || p.name;
  store.save();
  const mode = launch.hu_mode === 'test' ? 'test' : 'live';
  res.json({
    token: issueSession(huUserId, mode),
    mode,
    user: { id: huUserId, username: launch.hu_username ?? null, display_name: launch.hu_display_name ?? null, avatar: launch.hu_avatar ?? null },
  });
});

app.get('/api/state', auth, (req, res) => {
  const player = store.player(req.identity);
  const active = rounds.getActive(req.identity);
  res.json({
    identity: req.identity,
    name: player.name,
    balance: player.balance,
    history: player.history,
    topups: player.topups.slice(0, 20),
    stats: player.stats,
    gameStats: player.gameStats,
    commission: store.commission(),
    treasury: store.data.treasury,
    bonus: store.bonusState(req.identity),
    activeRound: active
      ? { id: active.id, bet: active.bet, startTs: active.startTs, cashedOut: active.cashedOut, cashoutAt: active.cashoutAt, payout: active.payout }
      : null,
    limits: { minBet: MIN_BET, maxBet: MAX_BET },
  });
});

app.post('/api/round/start', auth, (req, res) => {
  try {
    const bet = Number(req.body?.bet);
    const round = rounds.start(req.identity, bet);
    res.json({ id: round.id, bet: round.bet, startTs: round.startTs });
  } catch (e) {
    if (e instanceof RoundError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

app.get('/api/round/:id/stream', auth, (req, res) => {
  const round = rounds.get(String(req.params.id));
  if (!round || round.identity !== req.identity) return res.status(404).json({ error: 'Раунд не найден' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  if (round.resolved) {
    send({ event: 'crash', crashAt: round.crashAt, crashTs: round.crashTs });
    res.end();
    return;
  }

  const unsubscribe = rounds.subscribe(round.id, e => {
    send(e);
    res.end();
  });
  const timeout = setTimeout(() => {
    const now = rounds.get(round.id);
    if (now && !now.resolved) rounds.fireCrash(round.id);
  }, Math.max(0, round.crashTs - Date.now()));

  req.on('close', () => {
    clearTimeout(timeout);
    unsubscribe();
  });
});

app.post('/api/round/cashout', auth, (req, res) => {
  try {
    const result = rounds.cashout(String(req.body?.id || ''), req.identity);
    res.json({ multiplier: result.multiplier, payout: result.payout, balance: store.player(req.identity).balance });
  } catch (e) {
    if (e instanceof RoundError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

app.post('/api/faucet', auth, (req, res) => {
  const player = store.player(req.identity);
  player.balance += 1000;
  store.save();
  res.json({ balance: player.balance });
});

app.post('/api/bonus', auth, (req, res) => {
  const result = store.claimBonus(req.identity);
  if (!result.ok) return res.status(400).json({ error: 'Бонус уже забран', nextTs: result.nextTs });
  res.json({ balance: result.balance, nextTs: result.nextTs });
});

app.post('/api/profile', auth, (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const err = validateName(name);
  if (err) return res.status(400).json({ error: err });
  const player = store.player(req.identity);
  player.name = name;
  store.save();
  res.json({ name: player.name });
});

app.post('/api/topup', auth, (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount < 10 || amount > 100_000) {
    return res.status(400).json({ error: 'Сумма от 10 до 100 000' });
  }
  const idemKey = String(req.header('idempotency-key') || req.body?.idempotency_key || '');
  try {
    const result = grantTopup(req.identity, { amount, test: true, idemKey: idemKey || undefined });
    res.json({ ...result, balance: store.player(req.identity).balance });
  } catch (e) {
    if (e instanceof RoundError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

app.post('/api/topup/huevo', auth, async (req, res) => {
  if (!huevoConfigured()) return res.status(503).json({ error: 'huEVO не настроен' });
  const huId = req.session?.huUserId;
  if (!huId) return res.status(401).json({ error: 'Нужен вход через huEVO' });

  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100_000) {
    return res.status(400).json({ error: 'Сумма от 1 до 100 000 монет' });
  }
  const clientKey = String(req.body?.idempotency_key || '').slice(0, 64);
  const idemKey = (clientKey ? `topup:${req.identity}:${clientKey}` : `topup:${req.identity}:${Date.now()}`).slice(0, 64);
  const test = req.session?.mode === 'test';

  try {
    const intent = await huevoApi('POST', '/payments', {
      user_id: huId,
      amount,
      description: 'Пополнение баланса Взлёт (комиссия платформы 5%)',
      idempotency_key: idemKey,
      test,
    });
    res.json({ intent_id: intent.intent_id, status: intent.status, amount: intent.amount, test: intent.test, expires_in: intent.expires_in });
  } catch (e) {
    const err = e as Error & { code?: string };
    res.status(err.code === 'not_found' ? 404 : err.code === 'wallet_frozen' ? 403 : 400).json({ error: err.message, code: err.code });
  }
});

app.post('/api/topup/huevo/check', auth, async (req, res) => {
  if (!huevoConfigured()) return res.status(503).json({ error: 'huEVO не настроен' });
  const huId = req.session?.huUserId;
  if (!huId) return res.status(401).json({ error: 'Нужен вход через huEVO' });

  const intentId = String(req.body?.intent_id || '');
  if (!/^pi_[A-Za-z0-9]+$/.test(intentId)) return res.status(400).json({ error: 'Неверный intent_id' });

  try {
    const intent = await huevoApi('GET', `/payments/${intentId}`);
    if (intent.user_id !== huId) return res.status(403).json({ error: 'Намерение принадлежит другому игроку' });

    if (intent.status === 'succeeded') {
      const grant = grantTopup(req.identity, { amount: Number(intent.amount), test: Boolean(intent.test), intentId });
      return res.json({ status: intent.status, test: intent.test, ...grant });
    }
    const messages: Record<string, string> = {
      pending: 'Ожидает подтверждения',
      cancelled: 'Игрок отказался от оплаты',
      expired: 'Время подтверждения истекло (5 минут)',
      failed: 'Списание не прошло',
    };
    res.json({ status: intent.status, test: intent.test, granted: false, message: messages[String(intent.status)] ?? String(intent.status), error: intent.error ?? null });
  } catch (e) {
    const err = e as Error & { code?: string };
    res.status(err.code === 'not_found' ? 404 : 400).json({ error: err.message, code: err.code });
  }
});

app.use('/api', gameRoutes(store));
app.get('/api/admin/commission', requireAdmin, (_req, res) => {
  res.json({ ...store.commission(), treasury: store.data.treasury });
});

app.post('/api/admin/commission', requireAdmin, (req, res) => {
  const percent = Number(req.body?.percent);
  const enabled = req.body?.enabled !== false;
  if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
    return res.status(400).json({ error: 'Комиссия от 0 до 50%' });
  }
  store.setCommission(Math.floor(percent), enabled);
  res.json({ ...store.commission(), treasury: store.data.treasury });
});

// отдаём собранный фронтенд, если он есть
const FRONTEND_DIST = path.resolve(process.cwd(), '../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^\/(?!api\/|health).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`vzlet backend: http://localhost:${PORT} (DEV_AUTH=${DEV_AUTH})`);
});
