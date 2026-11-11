import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import Auth from "./Auth";
import NewAccount from "./NewAccount";
import Sheet from "./Sheet";
import type { Account } from "./types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setAccounts([]); return; }
    supabase.from("accounts").select("*").order("created_at").then(({ data }) => {
      const list = (data ?? []) as Account[];
      setAccounts(list);
      setActiveId((cur) => cur ?? list[0]?.id ?? null);
      if (list.length === 0) setAdding(true);
    });
  }, [session]);

  if (!ready) return null;
  if (!session) return <Auth />;

  const active = accounts.find((a) => a.id === activeId);

  return (
    <div className="shell">
      <header>
        <h1>Consistency Journal</h1>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <nav className="tabs">
        {accounts.map((a) => (
          <button key={a.id} className={!adding && a.id === activeId ? "tab on" : "tab"}
            onClick={() => { setActiveId(a.id); setAdding(false); }}>{a.name}</button>
        ))}
        <button className="tab add" onClick={() => setAdding(true)}>+ New account</button>
      </nav>

      {adding ? (
        <NewAccount
          onCancel={accounts.length ? () => setAdding(false) : undefined}
          onCreated={(a) => { setAccounts((l) => [...l, a]); setActiveId(a.id); setAdding(false); }}
        />
      ) : active ? (
        <Sheet
          key={active.id}
          account={active}
          onUpdated={(a) => setAccounts((l) => l.map((x) => (x.id === a.id ? a : x)))}
          onDeleted={(id) => {
            const rest = accounts.filter((x) => x.id !== id);
            setAccounts(rest);
            setActiveId(rest[0]?.id ?? null);
            if (!rest.length) setAdding(true);
          }}
        />
      ) : null}
    </div>
  );
}
