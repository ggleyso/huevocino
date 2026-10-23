import { useEffect, useRef, useState } from 'react';

const COLORS = ['#ffd166', '#f5a524', '#2ee66b', '#4da3ff', '#ff5fae', '#e8ecf8', '#ff7a1a'];

interface Piece {
  id: number;
  left: number;
  delay: number;
  dur: number;
  color: string;
  w: number;
  h: number;
  rot: number;
}

export function Confetti({ show, count = 64 }: { show: number; count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!show) return;
    idRef.current += 1;
    const gen = idRef.current;
    setPieces(
      Array.from({ length: count }, (_, i) => ({
        id: gen * 1000 + i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.4 + Math.random() * 1.1,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 8,
        rot: Math.random() * 720 - 360,
      })),
    );
    const t = window.setTimeout(() => setPieces([]), 3200);
    return () => window.clearTimeout(t);
  }, [show, count]);

  if (!pieces.length) return null;

  return (
    <div className="confetti-layer" aria-hidden>
      {pieces.map(p => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ['--conf-rot' as string]: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}
