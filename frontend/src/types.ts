export interface Card {
  suit: number; // 0♠ 1♥ 2♦ 3♣
  rank: number; // 0=2 … 7=9, 8=T, 9=J, 10=Q, 11=K, 12=A
}

export interface BlackjackView {
  bet: number;
  player: Card[];
  playerTotal: number;
  dealer: Card[];
  dealerUp: Card | null;
  dealerTotal: number | null;
  state: 'playing' | 'dealer' | 'done';
  doubled: boolean;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  result?: 'win' | 'lose' | 'push' | 'blackjack';
  payout: number;
}

export interface SlotInfo {
  id: string;
  name: string;
  symbols: string[];
  lines: number[][];
  wild: number;
  scatter: number;
  icon: string;
  frame: 'wood' | 'candy' | 'gold';
}

export interface SlotWin {
  line: number | null;
  symbol: number;
  count: number;
  amount: number;
}

export interface SpinResult {
  grid: string[][];
  wins: SlotWin[];
  payout: number;
  bet: number;
  balance: number;
}

export interface PokerView {
  ante: number;
  player: Card[];
  dealer: Card[];
  dealerUp: Card | null;
  state: 'decision' | 'done';
  canFold: boolean;
  canCall: boolean;
  callCost: number;
  playerHand: string | null;
  dealerHand: string | null;
  dealerQualified: boolean | null;
  result?: 'win' | 'lose' | 'push';
  payout: number;
  stake: number;
  note: string;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  balance: number;
  best: number;
  wins: number;
  rounds: number;
  demo: boolean;
  self: boolean;
}

export interface ArcadeMeta {
  id: string;
  name: string;
  icon: string;
  desc: string;
  tag: string;
}

export interface ArcadeView {
  phase: string;
  [key: string]: unknown;
}

export interface ArcadeState {
  view: ArcadeView;
  balance: number;
}
