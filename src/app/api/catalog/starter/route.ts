import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCatalog, STARTER_CATALOG } from "@/lib/catalog";

/** Fills an empty price list with a starter set the admin can then edit. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCatalog(session.user.role)) return NextResponse.json({ error: "Only an admin can change the price list." }, { status: 403 });
  if (await prisma.catalogCategory.count()) return NextResponse.json({ error: "The price list already has categories." }, { status: 409 });

  let items = 0;
  for (const [i, c] of STARTER_CATALOG.entries()) {
    await prisma.catalogCategory.create({
      data: {
        name: c.category,
        sortOrder: i,
        items: { create: c.items.map(([name, unit, rate, description], k) => ({ name, unit, rate, description: description ?? null, gstPct: 18, sortOrder: k })) },
      },
    });
    items += c.items.length;
  }
  return NextResponse.json({ ok: true, message: `Added ${STARTER_CATALOG.length} categories and ${items} items. Update the rates to match yours.` }, { status: 201 });
}
