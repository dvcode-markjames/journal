import type { Account, Entry } from "./types";

export interface Summary {
  total: number;
  bestDay: number;
  growth: number;
  targetUsd: number;
  consistency: number;
  maxBestDay: number;
  reward: number;
  growthMet: boolean;
  consistencyMet: boolean;
  ready: boolean;
}

export function summarize(a: Account, entries: Entry[]): Summary {
  const total = entries.reduce((s, e) => s + e.pnl, 0);
  const bestDay = Math.max(0, ...entries.map((e) => e.pnl));
  const targetUsd = a.account_size * a.growth_target;
  const consistency = total > 0 ? bestDay / total : 0;
  const growthMet = total >= targetUsd;
  const consistencyMet = consistency <= a.consistency_limit;
  return {
    total,
    bestDay,
    growth: total / a.account_size,
    targetUsd,
    consistency,
    maxBestDay: Math.max(0, total * a.consistency_limit),
    reward: Math.max(0, total * a.reward_share),
    growthMet,
    consistencyMet,
    ready: growthMet && consistencyMet,
  };
}

export const usd = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct = (n: number) => (n * 100).toFixed(1) + "%";

export const php = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });