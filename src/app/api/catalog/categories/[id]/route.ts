import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCatalog, categoryInputSchema } from "@/lib/catalog";

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCatalog(session.user.role)) return NextResponse.json({ error: "Only an admin can change the price list." }, { status: 403 });
  return null;
}

/** Rename, show/hide, or move up/down (`move: -1 | 1`). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;
  const cat = await prisma.catalogCategory.findUnique({ where: { id: params.id } });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();

  if (body.move === -1 || body.move === 1) {
    const all = await prisma.catalogCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } });
    const i = all.findIndex((c) => c.id === cat.id);
    const j = i + body.move;
    if (j >= 0 && j < all.length) {
      [all[i], all[j]] = [all[j], all[i]];
      await prisma.$transaction(all.map((c, k) => prisma.catalogCategory.update({ where: { id: c.id }, data: { sortOrder: k } })));
    }
    return NextResponse.json({ ok: true });
  }

  const parsed = categoryInputSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid category" }, { status: 422 });
  if (parsed.data.name) {
    const dup = await prisma.catalogCategory.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" }, id: { not: cat.id } } });
    if (dup) return NextResponse.json({ error: `“${dup.name}” already exists.` }, { status: 409 });
  }
  await prisma.catalogCategory.update({ where: { id: cat.id }, data: parsed.data });
  return NextResponse.json({ ok: true, message: parsed.data.active === false ? "Category hidden from quotations." : parsed.data.active ? "Category visible again." : "Category updated." });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;
  const cat = await prisma.catalogCategory.findUnique({ where: { id: params.id }, include: { _count: { select: { items: true } } } });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (cat._count.items) return NextResponse.json({ error: "Delete or move its items first, or hide the category instead." }, { status: 409 });
  await prisma.catalogCategory.delete({ where: { id: cat.id } });
  return NextResponse.json({ ok: true, message: `Category “${cat.name}” deleted.` });
}
