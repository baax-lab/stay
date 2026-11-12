"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef } from "react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Values = { q: string; source: string; role: string; status: string; sync: string };
type Options = Record<Exclude<keyof Values, "q">, Array<[string, string]>>;

const LABEL: Record<keyof Options, string> = { source: "Quelle", role: "Rolle", status: "Status", sync: "Hub" };

export function LeadFilters({ values, options }: { values: Values; options: Options }) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);

  function apply() {
    const fd = new FormData(formRef.current!);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (typeof v === "string" && v) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  }

  const active = Object.values(values).some(Boolean);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="flex flex-wrap gap-2"
    >
      <div className="w-full sm:w-64">
        <Input name="q" defaultValue={values.q} placeholder="Suchen…" />
      </div>
      {(Object.keys(options) as Array<keyof Options>).map((key) => (
        <div key={key} className="w-[calc(50%-0.25rem)] sm:w-44">
          <Select name={key} defaultValue={values[key]} onChange={apply}>
            <option value="">{LABEL[key]}: alle</option>
            {options[key].map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <Button type="submit" variant="secondary">
        Filtern
      </Button>
      {active && (
        <Button type="button" variant="ghost" onClick={() => router.push(pathname)}>
          Zurücksetzen
        </Button>
      )}
    </form>
  );
}
