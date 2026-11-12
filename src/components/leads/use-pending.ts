"use client";

import { useCallback, useEffect, useState } from "react";
import { countPending, flushPending, listPending, PENDING_EVENT, type PendingLead } from "@/lib/offline-store";

/** Beobachtet den Offline-Puffer und sendet bei Verbindung automatisch nach. */
export function usePending() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<PendingLead[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setCount(await countPending());
    setItems(await listPending());
  }, []);

  const flush = useCallback(async () => {
    setSyncing(true);
    try {
      const r = await flushPending();
      await refresh();
      return r;
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();
    void flush();

    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    const onChange = () => void refresh();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(PENDING_EVENT, onChange);
    const interval = setInterval(() => void flush(), 60_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(PENDING_EVENT, onChange);
      clearInterval(interval);
    };
  }, [refresh, flush]);

  return { count, items, online, syncing, flush, refresh };
}
