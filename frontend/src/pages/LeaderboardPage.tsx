import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, fmt } from '../api';
import { useGame } from '../store';
import type { LeaderboardRow } from '../types';

export function LeaderboardPage() {
  const myName = useGame(s => s.data?.name) ?? '';
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [selfRank, setSelfRank] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await apiGet<{ rows: LeaderboardRow[]; selfRank: number; total: number }>('/leaderboard');
      setRows(r.rows);
      setSelfRank(r.selfRank);
      setTotal(r.total);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rename = async () => {
    const cur = useGame.getState().data?.name ?? '';
    const next = window.prompt('Новое имя (3–16 символов):', cur);
    if (next === null || next.trim() === cur) return;
    setRenaming(true);
    try {
      await apiPost('/profile', { name: next.trim() });
      await useGame.getState().load();
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
    setRenaming(false);
  };

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

  return (
    <div className="game-page">
      <div className="page-head">
        <h2>🏆 Лидерборд</h2>
        <span className="balance-pill">Всего игроков: {total}</span>
      </div>

      {err && (
        <div className="err-banner" onClick={() => setErr(null)}>
          {err}
        </div>
      )}

      <div className="panel lb-self">
        Ваш ранг: <b style={{ color: 'var(--gold)' }}>{selfRank > 0 ? `#${selfRank}` : '—'}</b> из {total}
        <button className="btn-ghost" style={{ marginLeft: 10, padding: '3px 10px', fontSize: 12 }} disabled={renaming} onClick={() => void rename()}>
          ✏ {useGame.getState().data?.name ?? 'имя'}
        </button>
      </div>

      <div className="panel lb-table">
        <div className="lb-row lb-head">
          <span>Место</span>
          <span>Игрок</span>
          <span className="num">Баланс</span>
          <span className="num">Побед</span>
          <span className="num">Раундов</span>
          <span className="num">Лучший</span>
        </div>
        {rows.map(r => (
          <div key={r.rank} className={`lb-row${r.self ? ' self' : ''}`}>
            <span className="lb-rank">{medal(r.rank)}</span>
            <span className="lb-name">
              {r.name}
              {r.demo && <span className="demo-badge">демо</span>}
              {r.self && <span className="self-badge">вы</span>}
            </span>
            <span className="num" style={{ color: 'var(--gold)', fontWeight: 700 }}>
              🪙 {fmt(r.balance)}
            </span>
            <span className="num" style={{ color: 'var(--green)' }}>
              {r.wins}
            </span>
            <span className="num">{r.rounds}</span>
            <span className="num" style={{ color: '#8ea2e8' }}>
              x{r.best.toFixed(2)}
            </span>
          </div>
        ))}
        {rows.length === 0 && !err && <div className="muted-text text-center" style={{ padding: 16 }}>Пока пусто — сыграй партию!</div>}
      </div>

      <div className="hint text-center mt-2">Топ по балансу. Игроки с меткой «демо» — заглушка рейтинга.</div>
    </div>
  );
}
