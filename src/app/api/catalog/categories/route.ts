import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCatalog, categoryInputSchema } from "@/lib/catalog";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCatalog(session.user.role)) return NextResponse.json({ error: "Only an admin can change the price list." }, { status: 403 });

  const parsed = categoryInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid category" }, { status: 422 });
  const exists = await prisma.catalogCategory.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (exists) return NextResponse.json({ error: `“${exists.name}” already exists.` }, { status: 409 });

  const max = await prisma.catalogCategory.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.catalogCategory.create({ data: { name: parsed.data.name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  return NextResponse.json({ category, message: `Category “${category.name}” added.` }, { status: 201 });
}
