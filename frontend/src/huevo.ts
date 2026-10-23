const SESSION_KEY = 'vzlet_session';

export interface HuevoSession {
  token: string;
  mode: 'live' | 'test';
}

declare global {
  interface Window {
    huevo?: {
      init(opts?: { debug?: boolean; origins?: string[] }): Promise<{ app_id: number; mode: string; user: { id: number; username: string; display_name: string; avatar: string | null }; start: string | null }>;
      confirmPayment(intentId: string): Promise<{ intent_id: string; status: string; test: boolean; error?: string | null }>;
      on(event: string, cb: (...args: any[]) => void): void;
      off(event: string, cb: (...args: any[]) => void): void;
      [k: string]: any;
    };
  }
}

export function hasLaunchParams(): boolean {
  return new URLSearchParams(location.search).has('hu_hash');
}

export function getHuevoSession(): HuevoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as HuevoSession) : null;
  } catch {
    return null;
  }
}

export async function huevoLogin(): Promise<HuevoSession | null> {
  if (!hasLaunchParams()) return null;
  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: location.search }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as HuevoSession;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

export async function huevoConfirmPayment(intentId: string): Promise<{ status: string; test: boolean; error?: string | null }> {
  const h = window.huevo;
  if (!h) throw Object.assign(new Error('huEVO SDK не загружен'), { code: 'not_embedded' });
  const r = await h.confirmPayment(intentId);
  return { status: r.status, test: r.test, error: r.error ?? null };
}

export function huevoAvailable(): boolean {
  return Boolean(window.huevo && typeof window.huevo.init === 'function');
}
