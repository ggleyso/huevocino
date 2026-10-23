import { useState } from 'react';
import { apiPost, fmt, uuid } from './api';
import { useGame } from './store';
import { getHuevoSession, huevoAvailable, huevoConfirmPayment } from './huevo';

const PRESETS = [100, 500, 1000, 5000];

export function Wallet() {
  const { data, load, setWallet } = useGame();
  const [amount, setAmount] = useState(1000);
  const [busy, setBusy] = useState(false);

  if (!data) return null;

  const commission = data.commission;
  const fee = commission.enabled ? Math.floor((amount * commission.percent) / 100) : 0;
  const net = amount - fee;
  const session = getHuevoSession();
  const huevoMode = Boolean(session && huevoAvailable());

  const payDemo = async () => {
    if (!Number.isInteger(amount) || amount < 10) return alert('Минимум 10 монет');
    setBusy(true);
    try {
      const r = await apiPost<{ net: number; fee: number }>('/topup', { amount }, uuid());
      alert(`Зачислено ${fmt(r.net)} 🪙 (комиссия ${fmt(r.fee)} 🪙)`);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy(false);
  };

  const payHuevo = async () => {
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) return alert('Сумма от 1 до 100 000');
    setBusy(true);
    try {
      const intent = await apiPost<{ intent_id: string }>('/topup/huevo', { amount, idempotency_key: uuid() });
      try {
        const r = await huevoConfirmPayment(intent.intent_id);
        if (r.status !== 'succeeded' && r.status !== 'pending') {
          alert(r.status === 'cancelled' ? 'Оплата отменена' : `Статус: ${r.status}`);
          setBusy(false);
          return;
        }
      } catch (e) {
        if ((e as any)?.code === 'not_embedded') {
          alert('Оплата доступна только внутри приложения huEVO');
          setBusy(false);
          return;
        }
      }
      const check = await apiPost<{ status: string; granted?: boolean; already?: boolean; net?: number; fee?: number; message?: string }>('/topup/huevo/check', {
        intent_id: intent.intent_id,
      });
      if (check.granted) {
        alert(`Оплачено! Зачислено ${fmt(check.net ?? 0)} 🪙 (комиссия ${fmt(check.fee ?? 0)} 🪙)`);
        await load();
      } else if (check.already) {
        alert('Эта оплата уже зачтена');
      } else {
        alert(check.message || `Статус: ${check.status}`);
      }
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,7,15,0.82)', zIndex: 30, display: 'flex', alignItems: 'flex-end' }} onClick={() => setWallet(false)}>
      <div className="panel" style={{ width: '100%', borderRadius: '18px 18px 0 0', padding: 16 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <b style={{ fontSize: 17 }}>Кошелёк</b>
          <button className="btn-ghost" onClick={() => setWallet(false)}>
            ✕
          </button>
        </div>

        <div className="text-center mb-3" style={{ fontSize: 14 }}>
          Баланс: <b style={{ color: 'var(--gold)' }}>🪙 {fmt(data.balance)}</b>
        </div>

        <div className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
          {huevoMode
            ? session?.mode === 'test'
              ? 'Тестовый режим huEVO — монетки не списываются'
              : 'Оплата монетками huEVO'
            : 'Локальный режим — зачисление сразу'}
        </div>

        <div className="flex gap-2 mb-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p} className="btn-ghost" style={{ background: amount === p ? 'var(--accent)' : undefined, color: amount === p ? '#1a1205' : undefined, fontWeight: amount === p ? 800 : undefined }} onClick={() => setAmount(p)}>
              {fmt(p)}
            </button>
          ))}
        </div>

        <input type="number" min={10} value={amount} onChange={e => setAmount(Math.floor(Number(e.target.value) || 0))} className="mb-2" />

        <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--muted)' }}>
          <span>Комиссия платформы ({commission.percent}%)</span>
          <span>−{fmt(fee)} 🪙</span>
        </div>
        <div className="flex justify-between text-sm mb-3" style={{ fontWeight: 700 }}>
          <span>К зачислению</span>
          <span style={{ color: 'var(--gold)' }}>{fmt(net)} 🪙</span>
        </div>

        <button className="btn-primary" style={{ width: '100%' }} disabled={busy || amount < 10} onClick={huevoMode ? payHuevo : payDemo}>
          {busy ? 'Обработка…' : huevoMode ? `Оплатить ${fmt(amount)} монеток huEVO` : `Пополнить на ${fmt(amount)} 🪙`}
        </button>

        {data.topups.length > 0 && (
          <div className="mt-3" style={{ fontSize: 13 }}>
            <b>История пополнений</b>
            <div className="mt-1 space-y-1">
              {data.topups.slice(0, 8).map((t, i) => (
                <div key={i} className="flex justify-between">
                  <span style={{ color: 'var(--muted)' }}>
                    {new Date(t.ts).toLocaleString('ru-RU')} {t.test && <span style={{ color: 'var(--accent)' }}>(тест)</span>}
                  </span>
                  <span style={{ color: 'var(--gold)' }}>+{fmt(t.net)} 🪙</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
