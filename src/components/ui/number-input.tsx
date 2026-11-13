"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumberDe, parseNumberDe } from "@/lib/numbers";
import { Input } from "./field";

type Props = Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> & {
  /** Gesteuert: aktueller Wert und Rückmeldung */
  value?: number | null;
  onValueChange?: (n: number | null) => void;
  /** Ungesteuert (Server-Formulare): Startwert, der Rohwert geht unter `name` mit */
  defaultValue?: number | null;
  decimals?: number;
};

/**
 * Zahlenfeld mit Tausenderpunkten (1.250.000). Beim Tippen bleibt der Text, wie er eingegeben wird;
 * beim Verlassen des Felds wird formatiert. In Server-Formularen trägt ein verstecktes Feld den Rohwert.
 */
export function NumberInput({ value, onValueChange, defaultValue, decimals = 0, name, onBlur, onFocus, ...props }: Props) {
  const controlled = onValueChange !== undefined;
  const [own, setOwn] = useState<number | null>(defaultValue ?? null);
  const current = controlled ? (value ?? null) : own;
  const [text, setText] = useState<string | null>(null); // nur während der Eingabe gesetzt

  // Formular wird nach dem Absenden zurückgesetzt: Startwert wiederherstellen (ungesteuert)
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form || controlled) return;
    const onReset = () => {
      setOwn(defaultValue ?? null);
      setText(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  const round = (n: number | null) => (n === null ? null : decimals === 0 ? Math.round(n) : Math.round(n * 10 ** decimals) / 10 ** decimals);

  return (
    <>
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text ?? formatNumberDe(current, decimals)}
        onFocus={(e) => {
          setText(current === null ? "" : formatNumberDe(current, decimals));
          onFocus?.(e);
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = round(parseNumberDe(e.target.value));
          if (controlled) onValueChange?.(n);
          else setOwn(n);
        }}
        onBlur={(e) => {
          setText(null);
          onBlur?.(e);
        }}
      />
      {/* Rohwert ohne Tausenderpunkte, Dezimalstellen mit Komma: so lesen ihn alle Server-Aktionen richtig */}
      {name && !controlled ? <input type="hidden" name={name} value={current === null ? "" : String(current).replace(".", ",")} /> : null}
    </>
  );
}
