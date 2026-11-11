import { useState, type FormEvent } from "react";
import { supabase } from "./supabase";
import type { Account } from "./types";

export default function NewAccount({ onCreated, onCancel }: { onCreated: (a: Account) => void; onCancel?: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => Number(f.get(k));
    setBusy(true);
    setErr("");
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        name: String(f.get("name")).trim(),
        account_size: num("size"),
        growth_target: num("growth") / 100,
        consistency_limit: num("consistency") / 100,
        reward_share: num("reward") / 100,
      })
      .select()
      .single();
    if (error || !data) {
      setErr(error?.message ?? "Could not create the account.");
      setBusy(false);
      return;
    }
    const cyc = await supabase.from("cycles").insert({ account_id: data.id, cycle_no: 1 }).select().single();
    if (cyc.error || !cyc.data) {
      setErr(cyc.error?.message ?? "Could not start the first cycle.");
      setBusy(false);
      return;
    }
    const days = Array.from({ length: 7 }, (_, i) => ({ account_id: data.id, cycle_id: cyc.data.id, day_no: i + 1, pnl: 0 }));
    const res = await supabase.from("entries").insert(days);
    if (res.error) setErr(res.error.message);
    setBusy(false);
    onCreated(data as Account);
  }

  return (
    <form className="panel newacc" onSubmit={submit}>
      <h2>Add a trading account</h2>
      <label>Account name<input name="name" required placeholder="e.g. FundedNext 5K Evaluation" /></label>
      <div className="grid4">
        <label>Account size (USD)<input name="size" type="number" min="1" step="any" required defaultValue={5000} /></label>
        <label>Growth target (%)<input name="growth" type="number" step="any" required defaultValue={2} /></label>
        <label>Consistency limit (%)<input name="consistency" type="number" step="any" required defaultValue={40} /></label>
        <label>Reward share (%)<input name="reward" type="number" step="any" required defaultValue={90} /></label>
      </div>
      {err && <p className="notice bad">{err}</p>}
      <div className="row">
        <button className="primary" disabled={busy}>Create sheet</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}