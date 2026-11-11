export interface Account {
  id: string;
  name: string;
  account_size: number;
  growth_target: number;
  consistency_limit: number;
  reward_share: number;
}

export interface Cycle {
  id: string;
  account_id: string;
  cycle_no: number;
  status: "active" | "paid";
  started_at: string;
  paid_at: string | null;
  total_profit: number | null;
  payout_amount: number | null;
}

export interface Entry {
  id: string;
  account_id: string;
  cycle_id: string;
  day_no: number;
  trade_date: string | null;
  pnl: number;
  notes: string | null;
}