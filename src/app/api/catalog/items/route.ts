import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCatalog, itemInputSchema } from "@/lib/catalog";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCatalog(session.user.role)) return NextResponse.json({ error: "Only an admin can change the price list." }, { status: 403 });

  const parsed = itemInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid item" }, { status: 422 });
  const d = parsed.data;
  const cat = await prisma.catalogCategory.findUnique({ where: { id: d.categoryId }, select: { id: true } });
  if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  const dup = await prisma.catalogItem.findFirst({ where: { categoryId: d.categoryId, name: { equals: d.name, mode: "insensitive" } } });
  if (dup) return NextResponse.json({ error: `“${dup.name}” already exists in this category.` }, { status: 409 });

  const max = await prisma.catalogItem.aggregate({ where: { categoryId: d.categoryId }, _max: { sortOrder: true } });
  const item = await prisma.catalogItem.create({ data: { ...d, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "CATALOG_ITEM_CREATED", entityType: "CatalogItem", entityId: item.id } });
  return NextResponse.json({ item: { id: item.id }, message: `“${item.name}” added to the price list.` }, { status: 201 });
}
