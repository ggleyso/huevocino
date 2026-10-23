const DEVICE_KEY = 'vzlet_device_id';

export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function uuid(): string {
  return crypto.randomUUID();
}

function headers(idempotencyKey?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const session = localStorage.getItem('vzlet_session');
  if (session) {
    h['x-session'] = JSON.parse(session).token;
  } else {
    h['x-device-id'] = deviceId();
  }
  if (idempotencyKey) h['idempotency-key'] = idempotencyKey;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Ошибка ${res.status}`);
  return data as T;
}

export async function apiPost<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: headers(idempotencyKey),
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Ошибка ${res.status}`);
  return data as T;
}

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('ru-RU');
}
