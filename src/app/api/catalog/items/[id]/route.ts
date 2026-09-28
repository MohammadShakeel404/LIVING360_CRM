import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCatalog, itemInputSchema } from "@/lib/catalog";

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageCatalog(session.user.role)) return { error: NextResponse.json({ error: "Only an admin can change the price list." }, { status: 403 }) };
  return { session };
}

/** Edit rate / details, move to another category, or show / hide. Existing quotations are not affected. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.error) return g.error;
  const item = await prisma.catalogItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = itemInputSchema.partial().safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid item" }, { status: 422 });
  const d = parsed.data;

  const categoryId = d.categoryId ?? item.categoryId;
  const name = d.name ?? item.name;
  const dup = await prisma.catalogItem.findFirst({ where: { categoryId, name: { equals: name, mode: "insensitive" }, id: { not: item.id } } });
  if (dup) return NextResponse.json({ error: `“${dup.name}” already exists in that category.` }, { status: 409 });

  await prisma.catalogItem.update({ where: { id: item.id }, data: d });
  await prisma.activityLog.create({
    data: { userId: g.session.user.id, action: "CATALOG_ITEM_UPDATED", entityType: "CatalogItem", entityId: item.id, metadata: d.rate !== undefined ? { oldRate: Number(item.rate), newRate: d.rate } : undefined },
  });
  return NextResponse.json({ ok: true, message: d.active === false ? "Item hidden from quotations." : d.active ? "Item visible again." : "Item updated." });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.error) return g.error;
  const item = await prisma.catalogItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Quotation lines keep their own copy of name and rate, so deleting is always safe.
  await prisma.catalogItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true, message: `“${item.name}” deleted.` });
}
