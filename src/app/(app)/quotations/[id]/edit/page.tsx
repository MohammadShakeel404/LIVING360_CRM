import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, DISCOUNT_LIMITS } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { QuotationEditor } from "../../QuotationEditor";

export default async function EditQuotationPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const { role, id } = session!.user;
  if (!can(role, "quotations", "edit") || !can(role, "quotations", "financial")) {
    return <EmptyState icon={Lock} title="No access" note="Your role can't edit quotations." />;
  }
  const q = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: { select: { name: true } }, lead: { select: { name: true } } },
  });
  if (!q || (role === "SALES_EXECUTIVE" && q.salespersonId !== id)) notFound();
  if (q.status !== "DRAFT") redirect(`/quotations/${q.id}`);

  return (
    <QuotationEditor
      lockedParty={`${q.client?.name ?? q.lead?.name ?? "—"} · ${q.quotationNumber}`}
      initial={{
        id: q.id,
        leadId: q.leadId ?? "",
        clientId: q.clientId ?? "",
        validUntil: q.validUntil?.toISOString().slice(0, 10) ?? "",
        discountPct: q.discountPct.toString(),
        terms: q.termsAndConditions ?? "",
        items: q.items.map((i) => ({
          category: i.category, name: i.name, description: i.description ?? "", quantity: i.quantity.toString(),
          unit: i.unit, rate: i.rate.toString(), discountPct: i.discountPct.toString(), gstPct: String(Number(i.gstPct)),
        })),
      }}
      leads={[]}
      clients={[]}
      discountLimit={DISCOUNT_LIMITS[role]}
    />
  );
}
