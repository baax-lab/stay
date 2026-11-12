"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import type { ImportScope } from "@/lib/csv";
import { commitImport, previewImport, type ImportRow, type PreviewRow } from "@/lib/services/import";

export async function previewImportAction(scope: ImportScope, rows: ImportRow[]): Promise<PreviewRow[]> {
  await requirePermission("importData");
  if (rows.length > 2000) throw new Error("Maximal 2000 Zeilen je Import");
  return previewImport(scope, rows);
}

export async function commitImportAction(scope: ImportScope, rows: PreviewRow[], skipDuplicates: boolean): Promise<{ created: number; skipped: number }> {
  const user = await requirePermission("importData");
  const r = await commitImport(scope, rows, { skipDuplicates }, user);
  revalidatePath(`/${scope}`);
  revalidatePath("/auftraege");
  return r;
}
