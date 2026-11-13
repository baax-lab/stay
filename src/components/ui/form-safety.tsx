"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Notice } from "./card";

/**
 * Schutz vor Datenverlust in längeren Formularen:
 * - Entwurf wird auf dem Gerät gespeichert (localStorage), solange es ungespeicherte Änderungen gibt
 * - beim nächsten Öffnen: „Entwurf wiederherstellen“ oder „Verwerfen“
 * - Warnung beim Verlassen der Seite bzw. beim Klick auf einen Link
 * Entwürfe verfallen nach 7 Tagen und werden beim Abmelden gelöscht (Präfix DRAFT_PREFIX).
 */

export const DRAFT_PREFIX = "stay-draft:";
const MAX_AGE_MS = 7 * 86_400_000;

type Draft<T> = { at: number; value: T };

function read<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft<T>;
    if (!d || typeof d.at !== "number" || Date.now() - d.at > MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* Speicher nicht verfügbar */
  }
}

export function useFormSafety<T>(key: string, state: T, setState: (v: T) => void, { enabled = true }: { enabled?: boolean } = {}) {
  const saved = useRef(JSON.stringify(state));
  const [, rerender] = useState(0);
  const [draft, setDraft] = useState<Draft<T> | null>(null);
  const dirty = enabled && JSON.stringify(state) !== saved.current;

  // Vorhandenen Entwurf anbieten
  useEffect(() => {
    if (!enabled) return;
    const d = read<T>(key);
    if (d && JSON.stringify(d.value) !== saved.current) setDraft(d);
    else if (d) remove(key);
  }, [key, enabled]);

  // Entwurf mitschreiben (nicht, solange ein alter Entwurf auf Entscheidung wartet)
  useEffect(() => {
    if (!dirty || draft) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ at: Date.now(), value: state }));
      } catch {
        /* voll oder gesperrt: dann eben ohne Entwurf */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [state, dirty, draft, key]);

  // Warnung beim Verlassen
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download") || !a.href) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (!window.confirm("Es gibt ungespeicherte Änderungen. Trotzdem weiter? Ein Entwurf bleibt auf diesem Gerät gespeichert.")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  /** Nach erfolgreichem Speichern aufrufen: Stand gilt als gespeichert, Entwurf wird gelöscht. */
  const markSaved = useCallback(
    (value?: T) => {
      saved.current = JSON.stringify(value ?? state);
      remove(key);
      setDraft(null);
      rerender((n) => n + 1);
    },
    [key, state],
  );

  const notice = draft ? (
    <Notice tone="brand">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Ungespeicherter Entwurf vom {new Date(draft.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} auf diesem Gerät.
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            className="rounded-md bg-brand px-3 py-1 text-[13px] font-medium text-on-brand hover:bg-brand-strong hover:text-white"
            onClick={() => {
              setState(draft.value);
              setDraft(null);
            }}
          >
            Wiederherstellen
          </button>
          <button
            type="button"
            className="rounded-md px-3 py-1 text-[13px] text-muted hover:bg-surface-2 hover:text-ink"
            onClick={() => {
              remove(key);
              setDraft(null);
            }}
          >
            Verwerfen
          </button>
        </span>
      </div>
    </Notice>
  ) : null;

  return { dirty, markSaved, notice };
}
