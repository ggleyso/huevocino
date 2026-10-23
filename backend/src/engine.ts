import crypto from 'node:crypto';

export const TAU_MS = 2800;
export const HOUSE_EDGE = 0.97;
export const MIN_BET = 10;
export const MAX_BET = 100000;
export const START_BALANCE = 1000;

export function randomUnit(): number {
  const b = crypto.randomBytes(6);
  return b.readUIntBE(0, 6) / 2 ** 48;
}

export function rollCrash(r: number = randomUnit()): number {
  return Math.max(1, Math.floor((HOUSE_EDGE / (1 - r)) * 100) / 100);
}

export function multiplierAt(tMs: number): number {
  if (tMs <= 0) return 1;
  return Math.exp(tMs / TAU_MS);
}

export function crashTimeMs(crashAt: number): number {
  return Math.log(crashAt) * TAU_MS;
}

export function payoutFor(bet: number, multiplier: number): number {
  return Math.floor(bet * multiplier);
}

export function calcCommission(amount: number, percent: number, enabled: boolean): { fee: number; net: number } {
  const fee = enabled ? Math.floor((amount * percent) / 100) : 0;
  return { fee, net: amount - fee };
}
