import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';

process.env.HUEVO_CLIENT_ID = 'test-client';
process.env.HUEVO_CLIENT_SECRET = 'test-secret';
process.env.SESSION_SECRET = 'test-session';

const { verifyLaunch, verifyCallbackSignature, issueSession, verifySession } = await import('../src/lib/huevo.js');

function signLaunch(params: Record<string, string>, secret: string): string {
  const data = Object.keys(params)
    .filter(k => k.startsWith('hu_'))
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('\n');
  const key = crypto.createHash('sha256').update(secret).digest();
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

const BASE = {
  hu_app_id: '7',
  hu_user_id: '2002',
  hu_username: 'player2',
  hu_display_name: 'Игрок Два',
  hu_mode: 'test',
  hu_ts: String(Math.floor(Date.now() / 1000)),
};

describe('huEVO: подпись запуска', () => {
  it('валидная подпись проходит', () => {
    const hash = signLaunch(BASE, 'test-secret');
    const result = verifyLaunch('?' + new URLSearchParams({ ...BASE, hu_hash: hash }).toString());
    expect(result).not.toBeNull();
    expect(result!.hu_user_id).toBe('2002');
    expect(result!.hu_mode).toBe('test');
  });

  it('чужой секрет / подделка / протухание — отказ', () => {
    const hash = signLaunch(BASE, 'wrong');
    expect(verifyLaunch('?' + new URLSearchParams({ ...BASE, hu_hash: hash }).toString())).toBeNull();
    const good = signLaunch(BASE, 'test-secret');
    expect(verifyLaunch('?' + new URLSearchParams({ ...BASE, hu_user_id: '7777', hu_hash: good }).toString())).toBeNull();
    const old = { ...BASE, hu_ts: String(Math.floor(Date.now() / 1000) - 90000) };
    expect(verifyLaunch('?' + new URLSearchParams({ ...old, hu_hash: signLaunch(old, 'test-secret') }).toString())).toBeNull();
  });
});

describe('huEVO: подпись коллбека', () => {
  const body = Buffer.from(JSON.stringify({ event: 'payment', intent_id: 'pi_abc', status: 'succeeded', amount: 500, user_id: 2002 }));
  const sign = (b: Buffer, secret: string) => {
    const key = crypto.createHash('sha256').update(secret).digest();
    return crypto.createHmac('sha256', key).update(b).digest('hex');
  };

  it('валидная подпись ок, чужая и пустая — нет', () => {
    expect(verifyCallbackSignature(body, sign(body, 'test-secret'))).toBe(true);
    expect(verifyCallbackSignature(body, sign(body, 'nope'))).toBe(false);
    expect(verifyCallbackSignature(body, '')).toBe(false);
    expect(verifyCallbackSignature(Buffer.from('tampered'), sign(body, 'test-secret'))).toBe(false);
  });
});

describe('huEVO: сессии', () => {
  it('выпуск и проверка токена, режим сохраняется', () => {
    expect(verifySession(issueSession(5, 'live'))).toEqual({ huUserId: 5, mode: 'live' });
    expect(verifySession(issueSession(5, 'test'))).toEqual({ huUserId: 5, mode: 'test' });
    expect(verifySession('bad')).toBeNull();
    expect(verifySession(issueSession(5, 'live').replace(/\.[^.]+$/, '.00'))).toBeNull();
  });
});
