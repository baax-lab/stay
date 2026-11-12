"use server";

import { prisma } from "@/lib/db";
import { requireUserOrThrow } from "@/lib/auth";

export async function listSavedViewsAction(scope: string) {
  const user = await requireUserOrThrow();
  return prisma.savedView.findMany({ where: { userId: user.id, scope }, orderBy: { name: "asc" }, select: { id: true, name: true, query: true } });
}

export async function saveViewAction(scope: string, name: string, query: string) {
  const user = await requireUserOrThrow();
  await prisma.savedView.create({ data: { userId: user.id, scope, name: name.slice(0, 80), query: query.slice(0, 2000) } });
}

export async function deleteSavedViewAction(id: string) {
  const user = await requireUserOrThrow();
  await prisma.savedView.deleteMany({ where: { id, userId: user.id } });
}
