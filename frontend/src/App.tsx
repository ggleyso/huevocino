import { useEffect, useState, useSyncExternalStore } from 'react';
import { useGame } from './store';
import { Wallet } from './Wallet';
import { fmt } from './api';
import { huevoLogin, getHuevoSession, hasLaunchParams } from './huevo';
import { soundOn, subSound, toggleSound, sfx } from './sound';
import { VzletPage } from './pages/VzletPage';
import { BlackjackPage } from './pages/BlackjackPage';
import { SlotsPage } from './pages/SlotsPage';
import { PokerPage } from './pages/PokerPage';
import { ArcadePage } from './pages/ArcadePage';
import { LeaderboardPage } from './pages/LeaderboardPage';

type Tab = 'vzlet' | 'blackjack' | 'slots' | 'arcade' | 'poker' | 'leaderboard';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'vzlet', icon: '✈', label: 'Взлёт' },
  { id: 'blackjack', icon: '🃏', label: 'Блэкджек 21' },
  { id: 'slots', icon: '🎰', label: 'Слоты' },
  { id: 'arcade', icon: '🎮', label: 'Аркада ×15' },
  { id: 'poker', icon: '🂠', label: 'Покер' },
  { id: 'leaderboard', icon: '🏆', label: 'Лидерборд' },
];

export function App() {
  const { data, loaded, error, walletOpen, load, setError, setWallet } = useGame();
  const [tab, setTab] = useState<Tab>('vzlet');

  useEffect(() => {
    (async () => {
      if (hasLaunchParams() && !getHuevoSession()) await huevoLogin();
      await load();
    })();
  }, [load]);

  const sndOn = useSyncExternalStore(subSound, soundOn);

  if (!loaded && !data) {
    return (
      <div className="portal-loading">
        <div style={{ color: 'var(--muted)' }}>Загрузка…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="portal-loading">
        <div style={{ color: '#ff8f9c', marginBottom: 12, textAlign: 'center' }}>{error ?? 'Сервер недоступен'}</div>
        <button className="btn-primary" onClick={() => { setError(null); void load(); }}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="portal">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">HuEVOCINO</div>
          <div className="brand-sub">игровой портал</div>
        </div>

        <nav className="nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-item${tab === t.id ? ' on' : ''}`}
              onClick={() => {
                sfx.click();
                setTab(t.id);
              }}
            >
              <span className="nav-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="side-balance">
            <span className="side-balance-label">👤 {data?.name ?? 'Игрок'}</span>
            <b>🪙 {fmt(data?.balance ?? 0)}</b>
          </div>
          <button
            className="btn-ghost"
            style={{ padding: '7px 10px', fontSize: 15 }}
            onClick={() => toggleSound()}
            aria-label={sndOn ? 'Выключить звук' : 'Включить звук'}
            title={sndOn ? 'Звук включён' : 'Звук выключен'}
          >
            {sndOn ? '🔊' : '🔇'}
          </button>
          <button className="btn-primary" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} onClick={() => setWallet(true)}>
            Кошелёк
          </button>
        </div>
      </aside>

      <main className="main">
        {error && (
          <div className="err-banner" onClick={() => setError(null)}>
            {error}
          </div>
        )}
        <div className="page" key={tab}>
          {tab === 'vzlet' && <VzletPage />}
          {tab === 'blackjack' && <BlackjackPage />}
          {tab === 'slots' && <SlotsPage />}
          {tab === 'arcade' && <ArcadePage />}
          {tab === 'poker' && <PokerPage />}
          {tab === 'leaderboard' && <LeaderboardPage />}
        </div>
      </main>

      {walletOpen && <Wallet />}
    </div>
  );
}
