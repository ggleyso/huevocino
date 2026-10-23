import crypto from 'node:crypto';

export const HUEVO_API_BASE = 'https://huevo.su/api/apps/v1';
const MAX_AGE_DEFAULT = 24 * 3600;

export function huevoConfigured(): boolean {
  return Boolean(process.env.HUEVO_CLIENT_ID && process.env.HUEVO_CLIENT_SECRET);
}

function clientSecret(): string {
  const s = process.env.HUEVO_CLIENT_SECRET || '';
  if (!s) throw new Error('HUEVO_CLIENT_SECRET не задан');
  return s;
}

export function secretKey(): Buffer {
  return crypto.createHash('sha256').update(clientSecret()).digest();
}

export function verifyLaunch(query: string, maxAge = MAX_AGE_DEFAULT): Record<string, string> | null {
  const params = Object.fromEntries(new URLSearchParams(query.startsWith('?') ? query.slice(1) : query));
  const data = Object.keys(params)
    .filter(k => k.startsWith('hu_') && k !== 'hu_hash')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('\n');
  const key = crypto.createHash('sha256').update(clientSecret()).digest();
  const expected = crypto.createHmac('sha256', key).update(data).digest('hex');
  const given = params.hu_hash || '';
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return null;
  const age = Date.now() / 1000 - Number(params.hu_ts);
  if (!(age >= 0 && age <= maxAge)) return null;
  return Object.fromEntries(Object.entries(params).filter(([k]) => k.startsWith('hu_')));
}

export function verifyCallbackSignature(rawBody: Buffer | string, signature: string): boolean {
  const key = secretKey();
  const expected = crypto.createHmac('sha256', key).update(rawBody).digest('hex');
  const given = signature || '';
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export interface HuevoApiResponse {
  ok?: boolean;
  [k: string]: unknown;
}

export async function huevoApi(method: string, path: string, body?: unknown): Promise<HuevoApiResponse> {
  const auth = 'Basic ' + Buffer.from(`${process.env.HUEVO_CLIENT_ID}:${clientSecret()}`).toString('base64');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(HUEVO_API_BASE + path, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await resp.json().catch(() => ({}))) as HuevoApiResponse;
    if (!resp.ok) {
      const code = String((data as any).code || `http_${resp.status}`);
      const err = new Error(huevoErrorMessage(code)) as Error & { code: string };
      err.code = code;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function huevoErrorMessage(code: string): string {
  switch (code) {
    case 'bad_request': return 'Некорректный запрос к huEVO';
    case 'not_found': return 'Игрок huEVO не найден или заблокирован';
    case 'wallet_frozen': return 'Кошелёк приложения заморожен';
    case 'idempotency_conflict': return 'Конфликт ключа идемпотентности';
    case 'unauthorized': return 'Ошибка ключей доступа приложения';
    case 'app_blocked': return 'Аккаунт владельца приложения заблокирован';
    default: return `Ошибка huEVO API: ${code}`;
  }
}

export function sessionSecret(): Buffer {
  return crypto.createHash('sha256').update(process.env.SESSION_SECRET || clientSecret() || 'vzlet-dev-session').digest();
}

export function issueSession(huUserId: number, mode: string): string {
  const sig = crypto.createHmac('sha256', sessionSecret()).update(`session:${huUserId}:${mode}`).digest('hex');
  return `${huUserId}.${mode}.${sig}`;
}

export function verifySession(token: string): { huUserId: number; mode: string } | null {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  const [idStr, mode, sig] = parts;
  const huUserId = Number(idStr);
  if (!Number.isInteger(huUserId) || huUserId <= 0 || !sig) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(`session:${huUserId}:${mode}`).digest('hex');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  return { huUserId, mode };
}
