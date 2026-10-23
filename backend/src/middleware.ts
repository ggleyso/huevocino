import type { Request, Response, NextFunction } from 'express';
import { verifySession } from './lib/huevo.js';

declare module 'express-serve-static-core' {
  interface Request {
    identity: string;
    session?: { huUserId: number; mode: string };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function auth(req: Request, res: Response, next: NextFunction) {
  const devMode = process.env.DEV_AUTH === 'true';
  const sessionToken = req.header('x-session') || '';
  const deviceId = req.header('x-device-id') || '';

  if (sessionToken) {
    const s = verifySession(sessionToken);
    if (!s) return res.status(401).json({ error: 'Неверная сессия' });
    req.session = s;
    req.identity = `huevo:${s.huUserId}`;
  } else if (UUID_RE.test(deviceId)) {
    req.identity = `device:${deviceId.toLowerCase()}`;
  } else if (devMode) {
    req.identity = 'device:dev';
  } else {
    return res.status(401).json({ error: 'Нет идентификатора устройства' });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.header('x-admin-key') || '';
  if (!key || key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Неверный ключ администратора' });
  next();
}
