import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "./supabase";
import { summarize, usd, pct, php } from "./calc";
import { useUsdPhp } from "./rate";
import type { Account, Cycle, Entry } from "./types";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function Sheet({ account, onUpdated, onDeleted }: {
  account: Account;
  onUpdated: (a: Account) => void;
  onDeleted: (id: string) => void;
}) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [err, setErr] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [payoutAmt, setPayoutAmt] = useState("");
  const fx = useUsdPhp();

  useEffect(() => {
    setCycles([]);
    setCycleId(null);
    supabase.from("cycles").select("*").eq("account_id", account.id).order("cycle_no")
      .then(({ data, error }) => {
        if (error) return setErr(error.message);
        const list = (data ?? []) as Cycle[];
        setCycles(list);
        setCycleId((list.find((c) => c.status === "active") ?? list[list.length - 1])?.id ?? null);
      });
  }, [account.id]);

  useEffect(() => {
    setEntries([]);
    if (!cycleId) return;
    supabase.from("entries").select("*").eq("cycle_id", cycleId).order("day_no")
      .then(({ data, error }) => (error ? setErr(error.message) : setEntries((data ?? []) as Entry[])));
  }, [cycleId]);

  const cycle = cycles.find((c) => c.id === cycleId);
  const locked = cycle?.status === "paid";
  const totalPaid = cycles.reduce((t, c) => t + (c.payout_amount ?? 0), 0);
  const s = useMemo(() => summarize(account, entries), [account, entries]);

  async function saveEntry(id: string, patch: Partial<Entry>) {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from("entries").update(patch).eq("id", id);
    if (error) setErr(error.message);
  }

  async function addDay() {
    if (!cycleId || locked) return;
    const { data, error } = await supabase.from("entries")
      .insert({ account_id: account.id, cycle_id: cycleId, day_no: entries.length + 1, pnl: 0 }).select().single();
    if (error) setErr(error.message);
    else setEntries((es) => [...es, data as Entry]);
  }

  async function saveSetting(patch: Partial<Account>) {
    const { data, error } = await supabase.from("accounts").update(patch).eq("id", account.id).select().single();
    if (error) setErr(error.message);
    else onUpdated(data as Account);
  }

  async function submitSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k));
    if (!(n("size") > 0)) return setErr("Account size must be greater than 0.");
    await saveSetting({
      name: String(f.get("name")).trim() || account.name,
      account_size: n("size"),
      growth_target: n("growth") / 100,
      consistency_limit: n("consistency") / 100,
      reward_share: n("reward") / 100,
    });
    if (n("rate") > 0 && n("rate") !== fx.rate) fx.setManual(n("rate"));
    setErr("");
    setShowSettings(false);
  }

  function openPayout() {
    setPayoutAmt(s.reward.toFixed(2));
    setShowPayout(true);
  }

  async function submitPayout(e: FormEvent) {
    e.preventDefault();
    if (!cycle || locked) return;
    const amount = Number(payoutAmt);
    if (!Number.isFinite(amount) || amount < 0) return setErr("Enter a valid payout amount.");
    setErr("");

    const paid = await supabase.from("cycles")
      .update({ status: "paid", paid_at: new Date().toISOString(), total_profit: s.total, payout_amount: amount })
      .eq("id", cycle.id).select().single();
    if (paid.error || !paid.data) return setErr(paid.error?.message ?? "Could not close the cycle.");

    const next = await supabase.from("cycles")
      .insert({ account_id: account.id, cycle_no: cycle.cycle_no + 1 }).select().single();
    if (next.error || !next.data) return setErr(next.error?.message ?? "Could not start the next cycle.");

    const days = Array.from({ length: 7 }, (_, i) => ({ account_id: account.id, cycle_id: next.data.id, day_no: i + 1, pnl: 0 }));
    const res = await supabase.from("entries").insert(days);
    if (res.error) setErr(res.error.message);

    setCycles((cs) => [...cs.map((c) => (c.id === cycle.id ? (paid.data as Cycle) : c)), next.data as Cycle]);
    setCycleId(next.data.id);
    setShowPayout(false);
  }

  async function remove() {
    if (!confirm(`Delete "${account.name}" and all its cycles? This cannot be undone.`)) return;
    const { error } = await supabase.from("accounts").delete().eq("id", account.id);
    if (error) setErr(error.message);
    else onDeleted(account.id);
  }

  const growthFill = s.targetUsd > 0 ? Math.min(1, Math.max(0, s.total / s.targetUsd)) : 0;
  const consistencyFill = account.consistency_limit > 0 ? Math.min(1, s.consistency / account.consistency_limit) : 0;

  let running = 0;
  let best = 0;

  return (
    <section>
      <div className="head">
        <div>
          <h2 className="acct">{account.name}</h2>
          <span className={"pill " + (locked ? "paid" : "live")}>
            {cycle ? `Cycle ${cycle.cycle_no}, ${locked ? "paid" : "active"}` : "Loading"}
          </span>
        </div>
        <div className="toolbar">
          <button className="ghost sm" onClick={() => setShowSettings(true)}>Settings</button>
          {!locked && cycle && <button className="primary sm" onClick={openPayout}>Record payout</button>}
        </div>
      </div>

      <nav className="tabs">
        {cycles.map((c) => (
          <button key={c.id} className={c.id === cycleId ? "tab on" : "tab"} onClick={() => setCycleId(c.id)}>
            Cycle {c.cycle_no}{c.status === "paid" ? " (paid)" : ""}
          </button>
        ))}
      </nav>

      {locked && cycle && (
        <p className="notice">
          Paid out {usd(cycle.payout_amount ?? 0)} on {cycle.paid_at ? new Date(cycle.paid_at).toLocaleDateString() : ""}.
          This cycle is closed. Open the latest cycle to keep journaling.
        </p>
      )}
      {err && <p className="notice bad">{err}</p>}

      <div className="kpis">
        <div className="kpi">
          <span className="k">Total net profit</span>
          <strong className={s.total < 0 ? "loss" : ""}>{usd(s.total)}</strong>
          <span className="sub">Highest day {usd(s.bestDay)}</span>
        </div>
        <div className="kpi">
          <span className="k">Account growth</span>
          <strong>{pct(s.growth)}</strong>
          <div className="bar"><i className={s.growthMet ? "ok" : ""} style={{ width: `${growthFill * 100}%` }} /></div>
          <span className="sub">Target {usd(s.targetUsd)} ({pct(account.growth_target)})</span>
        </div>
        <div className="kpi">
          <span className="k">Consistency</span>
          <strong className={s.consistencyMet ? "" : "loss"}>{pct(s.consistency)}</strong>
          <div className="bar"><i className={s.consistencyMet ? "ok" : "bad"} style={{ width: `${consistencyFill * 100}%` }} /></div>
          <span className="sub">Limit {pct(account.consistency_limit)}, max best day {usd(s.maxBestDay)}</span>
        </div>
        <div className="kpi">
          <span className="k">Estimated reward share</span>
          <strong>{php(s.reward * fx.rate)}</strong>
          <span className="sub">{usd(s.reward)} at {php(fx.rate)} per $1</span>
        </div>
      </div>

      <div className={"status " + (s.ready ? "ok" : "")}>
        <b>{s.ready ? "Payout ready" : "Not yet eligible"}</b>
        <span>
          Growth target {s.growthMet ? "met" : "not met"}. Consistency {s.consistencyMet ? "within" : "over"} the limit.
          {totalPaid > 0 && ` Total paid out on this account: ${usd(totalPaid)}.`}
        </span>
      </div>

      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Day</th><th>Date</th><th>Daily net P/L</th><th>Cumulative</th><th>Best day so far</th><th>Notes / setup</th><th>Rule check</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              running += e.pnl;
              best = Math.max(best, e.pnl);
              return (
                <tr key={e.id}>
                  <td>Day {e.day_no}</td>
                  <td><input type="date" disabled={locked} defaultValue={e.trade_date ?? ""} onBlur={(ev) => saveEntry(e.id, { trade_date: ev.target.value || null })} /></td>
                  <td><input className={"num " + (e.pnl < 0 ? "loss" : e.pnl > 0 ? "gain" : "")} type="number" step="any" disabled={locked} defaultValue={e.pnl}
                    onBlur={(ev) => { const v = Number(ev.target.value) || 0; if (v !== e.pnl) saveEntry(e.id, { pnl: v }); }} /></td>
                  <td className="num">{usd(running)}</td>
                  <td className="num">{usd(best)}</td>
                  <td><input disabled={locked} defaultValue={e.notes ?? ""} onBlur={(ev) => saveEntry(e.id, { notes: ev.target.value || null })} /></td>
                  <td className={e.pnl < 0 ? "loss" : "muted"}>{e.pnl < 0 ? "Loss recorded" : "Recorded"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!locked && <button className="ghost sm" onClick={addDay}>Add a day</button>}
      </div>

      <p className="muted small">
        This is a personal tracking estimate. Confirm FundedNext's official eligible-profit calculation and treatment of
        losses/news adjustments before requesting a reward. Peso amounts use the exchange rate in Settings.
      </p>

      {showSettings && (
        <Modal title="Account settings" onClose={() => setShowSettings(false)}>
          <form className="mform" onSubmit={submitSettings}>
            <label>Account name<input name="name" required defaultValue={account.name} /></label>
            <div className="grid2">
              <label>Account size (USD)<input name="size" type="number" min="1" step="any" required defaultValue={account.account_size} /></label>
              <label>Reward share (%)<input name="reward" type="number" step="any" required defaultValue={account.reward_share * 100} /></label>
              <label>Growth target (%)<input name="growth" type="number" step="any" required defaultValue={account.growth_target * 100} /></label>
              <label>Consistency limit (%)<input name="consistency" type="number" step="any" required defaultValue={account.consistency_limit * 100} /></label>
            </div>
            <label>Exchange rate (PHP per 1 USD)
              <input name="rate" type="number" min="0" step="any" required key={fx.rate} defaultValue={fx.rate} />
            </label>
            <div className="row">
              <button type="button" className="ghost sm" onClick={fx.useLive}>Use live rate</button>
              <span className="muted small">
                {fx.auto ? "Live rate" : "Manual rate"}
                {fx.updated ? `, last updated ${new Date(fx.updated).toLocaleString()}` : ""}
              </span>
            </div>
            {fx.error && <p className="notice bad">{fx.error}</p>}
            <div className="mfoot">
              <button type="button" className="link danger" onClick={remove}>Delete account</button>
              <div className="row">
                <button type="button" className="ghost sm" onClick={() => setShowSettings(false)}>Cancel</button>
                <button className="primary sm">Save changes</button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {showPayout && cycle && (
        <Modal title="Record payout" onClose={() => setShowPayout(false)}>
          <form className="mform" onSubmit={submitPayout}>
            <p className="muted">
              This closes Cycle {cycle.cycle_no} and starts Cycle {cycle.cycle_no + 1} from zero. Closed cycles stay
              available as read-only history.
            </p>
            <dl className="compact">
              <div><dt>Cycle net profit</dt><dd>{usd(s.total)}</dd></div>
              <div><dt>Estimated reward</dt><dd>{usd(s.reward)} ({php(s.reward * fx.rate)})</dd></div>
            </dl>
            <label>Payout received (USD)
              <input type="number" min="0" step="any" required autoFocus value={payoutAmt} onChange={(e) => setPayoutAmt(e.target.value)} />
            </label>
            <p className="muted small">Approx. {php((Number(payoutAmt) || 0) * fx.rate)} at {php(fx.rate)} per $1</p>
            <div className="mfoot">
              <span />
              <div className="row">
                <button type="button" className="ghost sm" onClick={() => setShowPayout(false)}>Cancel</button>
                <button className="primary sm">Confirm payout</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}