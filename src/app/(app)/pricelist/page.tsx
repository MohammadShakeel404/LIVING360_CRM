import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { canManageCatalog } from "@/lib/catalog";
import { EmptyState } from "@/components/ui";
import { PriceListClient } from "./PriceListClient";

export default async function PriceListPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "quotations", "view")) return <EmptyState icon={Lock} title="No access" note="Your role doesn't use the quotation price list." />;
  const manage = canManageCatalog(role);

  const cats = await prisma.catalogCategory.findMany({
    where: manage ? {} : { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { items: { where: manage ? {} : { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });

  return (
    <PriceListClient
      canManage={manage}
      showRates={can(role, "quotations", "financial")}
      categories={cats.map((c) => ({
        id: c.id, name: c.name, active: c.active,
        items: c.items.map((i) => ({ id: i.id, categoryId: c.id, name: i.name, description: i.description, unit: i.unit, rate: Number(i.rate), gstPct: Number(i.gstPct), active: i.active })),
      }))}
    />
  );
}
