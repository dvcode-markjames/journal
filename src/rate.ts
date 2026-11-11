import { useCallback, useEffect, useState } from "react";

const RATE = "fx_usd_php";
const AUTO = "fx_usd_php_auto";
const TS = "fx_usd_php_ts";
const FALLBACK = 58; // used only until a live or manual rate is saved

export function useUsdPhp() {
  const [rate, setRate] = useState(() => {
    const v = Number(localStorage.getItem(RATE));
    return v > 0 ? v : FALLBACK;
  });
  const [auto, setAuto] = useState(() => localStorage.getItem(AUTO) !== "0");
  const [updated, setUpdated] = useState<string | null>(() => localStorage.getItem(TS));
  const [error, setError] = useState("");

  const fetchLive = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const json = await res.json();
      const live = json?.rates?.PHP;
      if (typeof live !== "number" || live <= 0) throw new Error("Invalid rate");
      const ts = new Date().toISOString();
      setRate(live);
      setUpdated(ts);
      localStorage.setItem(RATE, String(live));
      localStorage.setItem(TS, ts);
      return true;
    } catch {
      setError("Could not fetch the live rate. Using the last saved rate.");
      return false;
    }
  }, []);

  // Refresh automatically at most once an hour while in live mode.
  useEffect(() => {
    if (!auto) return;
    const last = updated ? Date.parse(updated) : 0;
    if (Date.now() - last > 3_600_000) void fetchLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setManual = (v: number) => {
    setAuto(false);
    setRate(v);
    localStorage.setItem(AUTO, "0");
    localStorage.setItem(RATE, String(v));
  };

  const useLive = async () => {
    setAuto(true);
    localStorage.setItem(AUTO, "1");
    return fetchLive();
  };

  return { rate, auto, updated, error, setManual, useLive };
}