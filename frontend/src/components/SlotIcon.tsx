const O = '#3a2a12';

function Bone() {
  return (
    <>
      <g stroke={O} strokeWidth="2.5" fill="#fdf6e6">
        <rect x="14" y="27" width="36" height="12" rx="6" />
        <circle cx="14" cy="26" r="9" />
        <circle cx="14" cy="40" r="9" />
        <circle cx="50" cy="26" r="9" />
        <circle cx="50" cy="40" r="9" />
      </g>
      <path d="M20 30 h24" stroke="#e8d9b8" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function DogFace() {
  return (
    <g stroke={O} strokeWidth="2.5">
      <ellipse cx="12" cy="34" rx="8" ry="13" fill="#6b3f1d" />
      <ellipse cx="52" cy="34" rx="8" ry="13" fill="#6b3f1d" />
      <circle cx="32" cy="32" r="20" fill="#a4682e" />
      <ellipse cx="32" cy="41" rx="11" ry="8" fill="#e8cfa8" />
      <ellipse cx="32" cy="36.5" rx="4" ry="3" fill="#2b1a0e" stroke="none" />
      <path d="M27 44 q5 4 10 0" fill="none" stroke="#2b1a0e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="25" cy="27" r="2.6" fill="#2b1a0e" stroke="none" />
      <circle cx="39" cy="27" r="2.6" fill="#2b1a0e" stroke="none" />
      <path d="M20 18 q5 -4 10 -1" fill="none" stroke="#7a4a1e" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 18 q-5 -4 -10 -1" fill="none" stroke="#7a4a1e" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function DogHouse() {
  return (
    <g stroke={O} strokeWidth="2.5" strokeLinejoin="round">
      <polygon points="32,5 61,29 3,29" fill="#c0392b" />
      <rect x="10" y="29" width="44" height="29" fill="#d9a05b" />
      <path d="M24 58 v-13 a8 8 0 0 1 16 0 v13 z" fill="#6b3f1d" />
      <path d="M10 38 h44" stroke="#b98d4f" strokeWidth="2" />
      <circle cx="36.5" cy="50" r="1.8" fill="#ffd166" stroke="none" />
    </g>
  );
}

function Paw() {
  return (
    <g fill="#7a4a1e" stroke={O} strokeWidth="2.5">
      <ellipse cx="32" cy="43" rx="14" ry="11" />
      <circle cx="17" cy="27" r="6.5" />
      <circle cx="27.5" cy="20" r="7" />
      <circle cx="38.5" cy="20" r="7" />
      <circle cx="48" cy="28" r="6.5" />
    </g>
  );
}

function Bell() {
  return (
    <g stroke={O} strokeWidth="2.5">
      <rect x="29" y="5" width="6" height="7" rx="2" fill="#e0a91b" />
      <path d="M32 11 c-9 0 -15 7 -15 16 v11 l-5 7 h40 l-5 -7 v-11 c0 -9 -6 -16 -15 -16 z" fill="#ffd166" />
      <path d="M22 24 q0 -8 7 -10" fill="none" stroke="#fff2c4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="51" r="4.5" fill="#b9770e" />
    </g>
  );
}

function StarWild() {
  return (
    <g>
      <polygon
        points="32,8 37.3,20.7 51,21.8 40.6,30.8 43.8,44.2 32,37 20.2,44.2 23.4,30.8 13,21.8 26.7,20.7"
        fill="url(#g-star)"
        stroke="#9c5a00"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="13" y="46" width="38" height="14" rx="7" fill="#f5a524" stroke="#9c5a00" strokeWidth="2" />
      <text x="32" y="56" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#4a2c00" fontFamily="Arial, sans-serif">
        WILD
      </text>
      <defs>
        <linearGradient id="g-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe89a" />
          <stop offset="1" stopColor="#f5a524" />
        </linearGradient>
      </defs>
    </g>
  );
}

function Lollipop() {
  return (
    <g>
      <rect x="30" y="32" width="5" height="24" rx="2.5" fill="#e8cfa8" stroke="#b98d4f" strokeWidth="2" />
      <circle cx="32" cy="25" r="18" fill="#fff" stroke="#d63f8b" strokeWidth="2.5" />
      <path d="M32 9 a16 16 0 1 1 -11.3 27.3" fill="none" stroke="#ff5fae" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M32 15 a10 10 0 1 1 -7.1 17.1" fill="none" stroke="#ff9dd0" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="32" cy="25" r="3" fill="#ff2f92" />
      <rect x="7" y="47" width="50" height="14" rx="7" fill="#ff5fae" stroke="#d63f8b" strokeWidth="2" />
      <text x="32" y="57" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff" fontFamily="Arial, sans-serif">
        SCATTER
      </text>
    </g>
  );
}

function Watermelon() {
  return (
    <g stroke={O} strokeWidth="2.5" strokeLinejoin="round">
      <path d="M6 46 a26 26 0 0 1 52 0 z" fill="#2ecc71" />
      <path d="M11 46 a21 21 0 0 1 42 0 z" fill="#f7f7f2" stroke="none" />
      <path d="M13.5 46 a18.5 18.5 0 0 1 37 0 z" fill="#e74c3c" stroke="none" />
      <ellipse cx="24" cy="38" rx="2" ry="2.8" fill="#2b1a0e" stroke="none" />
      <ellipse cx="32" cy="32" rx="2" ry="2.8" fill="#2b1a0e" stroke="none" />
      <ellipse cx="40" cy="38" rx="2" ry="2.8" fill="#2b1a0e" stroke="none" />
      <path d="M6 46 h52" stroke={O} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function Grapes() {
  return (
    <g stroke="#5b2c6f" strokeWidth="2">
      <path d="M33 14 q2 -8 9 -10" fill="none" stroke="#7a4a1e" strokeWidth="3" strokeLinecap="round" />
      <path d="M34 10 q9 -7 16 -3 q-7 9 -16 3 z" fill="#2ecc71" stroke="#1e8449" strokeWidth="2" />
      <circle cx="32" cy="19" r="7.5" fill="#9b59d0" />
      <circle cx="23" cy="28" r="7.5" fill="#8e44ad" />
      <circle cx="41" cy="28" r="7.5" fill="#8e44ad" />
      <circle cx="32" cy="32" r="7.5" fill="#9b59d0" />
      <circle cx="25" cy="42" r="7.5" fill="#8e44ad" />
      <circle cx="39" cy="42" r="7.5" fill="#8e44ad" />
      <circle cx="32" cy="50" r="7.5" fill="#9b59d0" />
      <circle cx="29" cy="24" r="2" fill="#c9a2ec" stroke="none" />
      <circle cx="36" cy="37" r="2" fill="#c9a2ec" stroke="none" />
    </g>
  );
}

function Banana() {
  return (
    <g>
      <path d="M15 14 Q21 52 53 51" fill="none" stroke={O} strokeWidth="17" strokeLinecap="round" />
      <path d="M15 14 Q21 52 53 51" fill="none" stroke="#ffd93d" strokeWidth="12" strokeLinecap="round" />
      <path d="M18 20 Q23 46 47 47" fill="none" stroke="#fff0a8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="15" cy="14" r="4" fill="#8a6a1a" stroke={O} strokeWidth="2" />
      <circle cx="53" cy="51" r="4" fill="#8a6a1a" stroke={O} strokeWidth="2" />
    </g>
  );
}

function Apple() {
  return (
    <g stroke={O} strokeWidth="2.5" strokeLinejoin="round">
      <rect x="30.5" y="10" width="3.5" height="12" rx="1.75" fill="#7a4a1e" />
      <path d="M35 14 q10 -9 17 -3 q-8 9 -17 3 z" fill="#2ecc71" stroke="#1e8449" strokeWidth="2" />
      <path d="M32 19 C 41 11, 55 17, 55 33 C 55 48, 43 58, 32 55 C 21 58, 9 48, 9 33 C 9 17, 23 11, 32 19 Z" fill="#e74c3c" />
      <path d="M16 28 q4 -7 10 -7" fill="none" stroke="#ff8f8f" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Cherry() {
  return (
    <g stroke={O} strokeWidth="2.5" strokeLinejoin="round">
      <path d="M28 36 Q33 14 46 9" fill="none" stroke="#7a4a1e" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 40 Q46 22 46 9" fill="none" stroke="#7a4a1e" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 9 q11 -7 15 0 q-7 9 -15 2 z" fill="#2ecc71" stroke="#1e8449" strokeWidth="2" />
      <circle cx="24" cy="47" r="12" fill="#d32f3a" />
      <circle cx="46" cy="50" r="11" fill="#c62828" />
      <circle cx="20" cy="43" r="3.5" fill="#ff8a80" stroke="none" />
      <circle cx="42.5" cy="46.5" r="3" fill="#ff8a80" stroke="none" />
    </g>
  );
}

function Lemon() {
  return (
    <g stroke="#d4a017" strokeWidth="2.5" strokeLinejoin="round">
      <g transform="rotate(-16 32 34)">
        <path d="M10 34 l-7 -4 v8 z" fill="#e6b800" />
        <path d="M54 34 l7 -4 v8 z" fill="#e6b800" />
        <ellipse cx="32" cy="34" rx="22" ry="14" fill="#ffe14d" />
        <path d="M17 27 q14 -6 28 0" fill="none" stroke="#fff8c4" strokeWidth="4" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Orange() {
  return (
    <g stroke="#d4760a" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M40 16 q4 -9 12 -9 q-1 10 -11 12 z" fill="#2ecc71" stroke="#1e8449" strokeWidth="2" />
      <rect x="30" y="12" width="4" height="8" rx="2" fill="#7a4a1e" stroke={O} strokeWidth="1.5" />
      <circle cx="32" cy="37" r="20" fill="#ff9f1c" />
      <path d="M18 28 q12 -8 26 -3" fill="none" stroke="#ffc46b" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 17 v40 M12 37 h40 M18 22 l28 30 M46 22 l-28 30" stroke="#f57c00" strokeWidth="1.2" opacity="0.55" />
    </g>
  );
}

function Diamond() {
  return (
    <g strokeLinejoin="round">
      <path d="M14 25 L22 12 H42 L50 25 L32 55 Z" fill="#8be9fd" stroke="#3a8fb7" strokeWidth="2.5" />
      <path d="M14 25 H50 M22 12 L27 25 L32 55 M42 12 L37 25 L32 55 M27 25 H37" fill="none" stroke="#3a8fb7" strokeWidth="1.6" />
      <path d="M23 13 L28 24 L34 13 Z" fill="#ffffff" opacity="0.55" />
    </g>
  );
}

function Clover() {
  return (
    <g stroke="#1e8449" strokeWidth="2.5">
      <path d="M32 46 q3 12 14 15" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="17" r="10" fill="#3ddc7f" />
      <circle cx="47" cy="32" r="10" fill="#2ecc71" />
      <circle cx="32" cy="47" r="10" fill="#3ddc7f" />
      <circle cx="17" cy="32" r="10" fill="#2ecc71" />
      <path d="M32 32 l7 -7 M32 32 l7 7 M32 32 l-7 7 M32 32 l-7 -7" stroke="#1e8449" strokeWidth="2" />
    </g>
  );
}

function Dice() {
  return (
    <g stroke="#b3261e" strokeWidth="2.5" strokeLinejoin="round">
      <rect x="11" y="11" width="42" height="42" rx="9" fill="#fffdf8" />
      <circle cx="22" cy="22" r="4.5" fill="#16203c" stroke="none" />
      <circle cx="42" cy="22" r="4.5" fill="#16203c" stroke="none" />
      <circle cx="32" cy="32" r="4.5" fill="#cf1f3d" stroke="none" />
      <circle cx="22" cy="42" r="4.5" fill="#16203c" stroke="none" />
      <circle cx="42" cy="42" r="4.5" fill="#16203c" stroke="none" />
      <path d="M16 17 q3 -4 8 -5" fill="none" stroke="#ffd9d6" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Bolt() {
  return (
    <polygon points="37,5 15,36 27,36 23,59 49,26 34,26" fill="#ffd93d" stroke="#d4a017" strokeWidth="2.5" strokeLinejoin="round" />
  );
}

function Fish() {
  return (
    <g stroke="#0288d1" strokeWidth="2.5" strokeLinejoin="round">
      <polygon points="44,32 62,18 62,46" fill="#29b6f6" />
      <ellipse cx="27" cy="32" rx="21" ry="14" fill="#4fc3f7" />
      <polygon points="27,19 35,9 40,20" fill="#81d4fa" strokeWidth="2" />
      <path d="M34 20 q-4 12 0 24" fill="none" stroke="#0288d1" strokeWidth="2" />
      <circle cx="15" cy="28" r="3.6" fill="#fff" stroke="none" />
      <circle cx="14" cy="28" r="2" fill="#16203c" stroke="none" />
      <path d="M7 33 q3 3 7 3" fill="none" stroke="#0288d1" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Gift() {
  return (
    <g stroke="#b71c1c" strokeWidth="2.5" strokeLinejoin="round">
      <rect x="12" y="27" width="40" height="26" rx="3" fill="#ef5350" />
      <rect x="8" y="17" width="48" height="12" rx="3" fill="#e53935" />
      <rect x="27.5" y="17" width="9" height="36" fill="#ffd54f" stroke="#f9a825" strokeWidth="2" />
      <ellipse cx="23" cy="12" rx="8" ry="6" transform="rotate(-24 23 12)" fill="#ffd54f" stroke="#f9a825" strokeWidth="2" />
      <ellipse cx="41" cy="12" rx="8" ry="6" transform="rotate(24 41 12)" fill="#ffd54f" stroke="#f9a825" strokeWidth="2" />
      <circle cx="32" cy="16" r="4.5" fill="#ffe082" stroke="#f9a825" strokeWidth="2" />
    </g>
  );
}

function Blossom() {
  const petal = (cx: number, cy: number) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="10.5" fill="#ff9ecb" stroke="#e0559a" strokeWidth="2.5" />;
  return (
    <g>
      {petal(32, 15)}
      {petal(46, 25)}
      {petal(41, 41.5)}
      {petal(23, 41.5)}
      {petal(18, 25)}
      <circle cx="32" cy="30" r="7.5" fill="#ffd166" stroke="#d4a017" strokeWidth="2.5" />
      <path d="M46 50 q10 2 12 11 q-11 3 -14 -7 z" fill="#3ddc7f" stroke="#1e8449" strokeWidth="2" />
    </g>
  );
}

function Mushroom() {
  return (
    <g strokeLinejoin="round">
      <rect x="24.5" y="30" width="15" height="22" rx="5" fill="#f5e6c8" stroke={O} strokeWidth="2.5" />
      <path d="M13 33 a19 19 0 0 1 38 0 z" fill="#e74c3c" stroke={O} strokeWidth="2.5" />
      <circle cx="24" cy="25" r="3.6" fill="#fff" stroke="none" />
      <circle cx="36" cy="20" r="4.2" fill="#fff" stroke="none" />
      <circle cx="44" cy="28" r="3.2" fill="#fff" stroke="none" />
      <path d="M17 17 q5 -5 12 -5" fill="none" stroke="#ff8f8f" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

const K = '#1b2450';

function Rocket() {
  return (
    <g stroke={K} strokeWidth="2.5" strokeLinejoin="round">
      <path d="M32 4 c9 7 13 17 13 27 v10 H19 V31 C19 21 23 11 32 4 z" fill="#f2f5ff" />
      <path d="M19 31 c-6 3 -9 10 -9 17 l9 0 z" fill="#cf1f3d" />
      <path d="M45 31 c6 3 9 10 9 17 l-9 0 z" fill="#cf1f3d" />
      <circle cx="32" cy="25" r="7" fill="#5bb8ff" />
      <path d="M24 41 h16 v5 H24 z" fill="#9c3535" />
      <path d="M27 46 q5 14 10 0 q-2 7 -5 7 q-3 0 -5 -7 z" fill="#ff9f1a" stroke="#e2680f" strokeWidth="2" />
      <path d="M25 17 q4 -6 10 -9" fill="none" stroke="#dbe4ff" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Moon() {
  return (
    <g strokeLinejoin="round">
      <path d="M38 6 a26 26 0 1 0 0 52 a20 20 0 1 1 0 -52 z" fill="#ffd166" stroke="#c99a12" strokeWidth="2.5" />
      <circle cx="24" cy="27" r="4" fill="#e8b93a" stroke="none" />
      <circle cx="30" cy="41" r="3" fill="#e8b93a" stroke="none" />
      <circle cx="20" cy="39" r="2.4" fill="#e8b93a" stroke="none" />
      <path d="M18 18 q6 -5 13 -7" fill="none" stroke="#fff0c0" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Ufo() {
  return (
    <g stroke={K} strokeWidth="2.5" strokeLinejoin="round">
      <path d="M32 11 v6" />
      <circle cx="32" cy="9" r="3.4" fill="#ff5fae" />
      <path d="M20 31 a12 12 0 0 1 24 0 z" fill="#aee3ff" />
      <ellipse cx="32" cy="34" rx="25" ry="9.5" fill="#b9c3e6" />
      <circle cx="17" cy="37" r="2.6" fill="#ffd166" stroke="none" />
      <circle cx="32" cy="41" r="2.6" fill="#7dffa7" stroke="none" />
      <circle cx="47" cy="37" r="2.6" fill="#ff6b6b" stroke="none" />
      <path d="M24 26 a9 9 0 0 1 6 -5" fill="none" stroke="#eafaff" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Earth() {
  return (
    <g strokeLinejoin="round">
      <circle cx="32" cy="32" r="26" fill="#4da3ff" stroke={K} strokeWidth="2.5" />
      <path
        d="M12 27 c5 -7 12 -7 16 -3 c4 4 10 3 14 0 c4 -3 9 -1 10 4 c1 5 -4 7 -9 6 c-6 -1 -9 3 -15 3 c-7 0 -12 -4 -16 -7 c-3 -2 -2 -2 0 -3 z"
        fill="#3ddc7f"
        stroke="#1e8449"
        strokeWidth="2"
      />
      <path d="M22 45 c6 -3 13 -1 16 3 c2 4 1 8 -4 10 c-6 2 -13 -1 -14 -6 c-1 -4 0 -6 2 -7 z" fill="#3ddc7f" stroke="#1e8449" strokeWidth="2" />
      <path d="M15 21 a24 24 0 0 1 11 -12" fill="none" stroke="#dff1ff" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
    </g>
  );
}

const ICONS: Record<string, () => JSX.Element> = {
  '🦴': Bone,
  '🐕': DogFace,
  '🏠': DogHouse,
  '🐾': Paw,
  '🔔': Bell,
  '⭐': StarWild,
  '🍬': Lollipop,
  '🍭': Watermelon,
  '🍫': Grapes,
  '🍩': Banana,
  '🧁': Apple,
  '🍒': Cherry,
  '🍋': Lemon,
  '🍊': Orange,
  '💎': Diamond,
  '🍀': Clover,
  '🎲': Dice,
  '⚡': Bolt,
  '🐟': Fish,
  '🎁': Gift,
  '🌸': Blossom,
  '🍄': Mushroom,
  '🚀': Rocket,
  '🌙': Moon,
  '🛸': Ufo,
  '🌍': Earth,
};

export const SYMBOL_NAMES: Record<string, string> = {
  '🦴': 'Кость',
  '🐕': 'Пёс',
  '🏠': 'Будка',
  '🐾': 'Лапа',
  '🔔': 'Колокольчик',
  '⭐': 'Вилд',
  '🍬': 'Леденец',
  '🍭': 'Арбуз',
  '🍫': 'Виноград',
  '🍩': 'Банан',
  '🧁': 'Яблоко',
  '🍒': 'Вишня',
  '🍋': 'Лимон',
  '🍊': 'Апельсин',
  '💎': 'Алмаз',
  '🍀': 'Клевер',
  '🎲': 'Кубик',
  '⚡': 'Молния',
  '🐟': 'Рыба',
  '🎁': 'Подарок',
  '🌸': 'Цветок',
  '🍄': 'Гриб',
  '🚀': 'Ракета',
  '🌙': 'Луна',
  '🛸': 'Тарелка',
  '🌍': 'Планета',
};

export function SlotIcon({ sym, size = 54 }: { sym: string; size?: number }) {
  const draw = ICONS[sym];
  if (!draw) {
    return (
      <span style={{ fontSize: Math.round(size * 0.8), lineHeight: 1 }} className="slot-icon-fallback">
        {sym}
      </span>
    );
  }
  const Shape = draw;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="slot-icon" aria-label={SYMBOL_NAMES[sym] ?? sym}>
      <Shape />
    </svg>
  );
}
