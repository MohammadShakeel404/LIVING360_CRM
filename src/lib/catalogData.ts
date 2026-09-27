import { prisma } from "@/lib/prisma";
import type { CatalogForEditor } from "@/lib/catalog";

/** Active categories and items, ordered for the quotation editor dropdowns. */
export async function loadCatalog(): Promise<CatalogForEditor> {
  const cats = await prisma.catalogCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { items: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    items: c.items.map((i) => ({ id: i.id, name: i.name, description: i.description, unit: i.unit, rate: Number(i.rate), gstPct: Number(i.gstPct) })),
  }));
}
