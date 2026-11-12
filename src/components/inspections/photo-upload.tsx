"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadInspectionPhotosAction } from "@/app/(app)/besichtigungen/actions";
import { Notice } from "@/components/ui/card";

/** Fotos direkt aus der Handykamera (capture) oder der Galerie; Upload sofort nach Auswahl. */
export function InspectionPhotoUpload({ id }: { id: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <label className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand text-base font-medium text-petrol">
        {pending ? "Lade hoch…" : "Foto aufnehmen oder auswählen"}
        <input
          ref={ref}
          type="file"
          name="photos"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          data-testid="inspection-photo-input"
          onChange={(e) => {
            const files = e.target.files;
            if (!files?.length) return;
            const fd = new FormData();
            for (const f of Array.from(files)) fd.append("photos", f);
            start(async () => {
              const r = await uploadInspectionPhotosAction(id, fd);
              setMsg(r.ok ? { ok: true, text: r.message ?? "Gespeichert." } : { ok: false, text: r.error });
              if (ref.current) ref.current.value = "";
              router.refresh();
            });
          }}
        />
      </label>
      {msg && <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>}
    </div>
  );
}
