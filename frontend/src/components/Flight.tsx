import { useEffect, useRef, useState } from 'react';
import { sfx } from '../sound';

const TAU_MS = 2800;
const W = 420;
const H = 240;

function pointAt(t: number): { x: number; y: number } {
  const p = 1 - Math.exp(-t / 2600);
  return {
    x: 24 + p * (W - 60),
    y: H - 34 - Math.pow(p, 1.35) * (H - 90),
  };
}

function angleAt(t: number): number {
  const a = pointAt(Math.max(0, t - 16));
  const b = pointAt(t + 1);
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function multiplierAt(t: number): number {
  if (t <= 0) return 1;
  return Math.exp(t / TAU_MS);
}

interface FlightProps {
  phase: 'idle' | 'flying' | 'ended';
  startTs: number | null;
  crashAt: number | null;
  result: { win: boolean; multiplier: number | null; payout: number; crashAt: number | null } | null;
  onTick: (m: number) => void;
}

export function Flight({ phase, startTs, crashAt, result, onTick }: FlightProps) {
  const [t, setT] = useState(0);
  const [flash, setFlash] = useState(false);
  const raf = useRef(0);
  const lastTick = useRef(0);
  const whole = useRef(1);

  useEffect(() => {
    if (phase !== 'flying' || !startTs) {
      if (phase === 'ended' && crashAt != null) {
        const endT = Math.log(crashAt) * TAU_MS;
        setT(endT);
        setFlash(true);
        const id = setTimeout(() => setFlash(false), 500);
        return () => clearTimeout(id);
      }
      if (phase === 'idle') setT(0);
      return;
    }
    whole.current = 1;
    const loop = () => {
      const now = Date.now();
      const elapsed = now - startTs;
      setT(elapsed);
      const mm = multiplierAt(elapsed);
      if (Math.floor(mm) > whole.current) {
        whole.current = Math.floor(mm);
        sfx.tick();
      }
      if (now - lastTick.current > 90) {
        lastTick.current = now;
        onTick(mm);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, startTs, crashAt, onTick]);

  const idle = phase === 'idle';
  const showT = idle ? 0 : t;
  const pt = pointAt(showT);
  const ang = idle ? -6 : angleAt(showT);

  const trail: string[] = [];
  const step = 90;
  const samples = Math.min(400, Math.floor(showT / step));
  for (let i = 0; i <= samples; i++) {
    const p = pointAt(i * step);
    trail.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  trail.push(`${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);

  const m = idle ? 1 : multiplierAt(showT);
  const shown = result?.win && phase === 'ended' ? (result.multiplier ?? m) : m;

  return (
    <div className="relative" style={{ background: 'linear-gradient(180deg, #070a16 0%, #101736 55%, #1d2450 100%)', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden' }}>
      <Stars />

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f5a524" stopOpacity="0" />
            <stop offset="100%" stopColor="#ffd166" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="boom">
            <stop offset="0%" stopColor="#fff2b0" />
            <stop offset="45%" stopColor="#ff7a1a" />
            <stop offset="100%" stopColor="#ff4d5e" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* линия горизонта / полоса */}
        <line x1="0" y1={H - 16} x2={W} y2={H - 16} stroke="#2a3358" strokeWidth="2" />
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={i} x={12 + i * 30} y={H - 17.5} width="14" height="3" fill={i % 2 ? '#3b4777' : '#54619c'} rx="1.5" />
        ))}

        {/* траектория */}
        {trail.length > 1 && (
          <polyline points={trail.join(' ')} fill="none" stroke="url(#trail)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glow)" />
        )}

        {/* взрыв */}
        {phase === 'ended' && crashAt != null && (
          <g>
            <circle cx={pt.x} cy={pt.y} r={flash ? 46 : 30} fill="url(#boom)" opacity={flash ? 1 : 0.85} />
            <text x={pt.x} y={pt.y + 8} textAnchor="middle" fontSize="26">
              💥
            </text>
          </g>
        )}

        {/* самолётик */}
        {!(phase === 'ended' && crashAt != null) && (
          <g transform={`translate(${pt.x} ${pt.y}) rotate(${ang})`}>
            <g filter="url(#glow)">
              <path d="M -16 0 L -4 -3 L 10 -3.5 L 17 0 L 10 3.5 L -4 3 Z" fill="#e8ecf8" />
              <path d="M -2 -3 L 3 -11 L 7 -11 L 4 -3 Z" fill="#8ea2e8" />
              <path d="M -3 3 L 0 9 L 4 9 L 3 3 Z" fill="#8ea2e8" />
              <path d="M -16 0 L -20 -6 L -14 -3 Z" fill="#f5a524" />
              <circle cx="12" cy="0" r="1.6" fill="#f5a524" />
            </g>
          </g>
        )}
      </svg>

      {/* множитель */}
      <div className="absolute inset-x-0 top-3 text-center pointer-events-none">
        <div
          className="font-black"
          style={{
            fontSize: 44,
            letterSpacing: 1,
            color: phase === 'ended' && !result?.win ? 'var(--red)' : phase === 'ended' && result?.win ? 'var(--gold)' : phase === 'flying' ? 'var(--green)' : 'var(--muted)',
            textShadow: phase === 'flying' ? '0 0 24px rgba(46,230,107,0.55)' : undefined,
            transition: 'color .2s',
          }}
        >
          {phase === 'idle' ? '—.——×' : `${shown.toFixed(2)}×`}
        </div>
        {phase === 'flying' && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Выводи до падения</div>
        )}
        {phase === 'ended' && result && (
          <div style={{ fontSize: 15, marginTop: 4, fontWeight: 700, color: result.win ? 'var(--gold)' : 'var(--red)' }}>
            {result.win
              ? `Забрал ${result.payout.toLocaleString('ru-RU')} 🪙 (x${result.multiplier?.toFixed(2)})`
              : `Разбился на x${(result.crashAt ?? 0).toFixed(2)}`}
          </div>
        )}
      </div>

      {flash && <div className="absolute inset-0" style={{ background: 'rgba(255,77,94,0.25)', animation: 'shake .35s' }} />}
    </div>
  );
}

function Stars() {
  const stars = useRef(
    Array.from({ length: 42 }).map(() => ({
      left: Math.random() * 100,
      top: Math.random() * 62,
      r: Math.random() * 1.4 + 0.4,
      o: Math.random() * 0.6 + 0.25,
    })),
  ).current;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.r * 2,
            height: s.r * 2,
            borderRadius: '50%',
            background: '#cdd7ff',
            opacity: s.o,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          right: '8%',
          top: '12%',
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #fff7d6, #e8d9a0)',
          boxShadow: '0 0 26px rgba(255,241,190,0.45)',
          opacity: 0.9,
        }}
      />
    </div>
  );
}
