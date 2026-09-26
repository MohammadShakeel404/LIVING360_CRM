import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, DISCOUNT_LIMITS } from "@/lib/permissions";
import { getCompanySettings } from "@/lib/settings";
import { EmptyState } from "@/components/ui";
import { QuotationEditor } from "../QuotationEditor";

export default async function NewQuotationPage({ searchParams }: { searchParams: { leadId?: string; clientId?: string } }) {
  const session = await getServerSession(authOptions);
  const { role, id } = session!.user;
  if (!can(role, "quotations", "create")) {
    return <EmptyState icon={Lock} title="No access" note="Your role can't create quotations." />;
  }

  const [settings, leads, clients] = await Promise.all([
    getCompanySettings(),
    prisma.lead.findMany({
      where: { stage: { notIn: ["CONVERTED", "LOST"] }, ...(role === "SALES_EXECUTIVE" ? { assignedToId: id } : {}) },
      select: { id: true, name: true, leadNumber: true },
      orderBy: { name: "asc" },
    }),
    role === "SALES_EXECUTIVE"
      ? prisma.client.findMany({ where: { lead: { assignedToId: id } }, select: { id: true, name: true, clientNumber: true }, orderBy: { name: "asc" } })
      : prisma.client.findMany({ select: { id: true, name: true, clientNumber: true }, orderBy: { name: "asc" } }),
  ]);

  const validUntil = new Date(Date.now() + settings.quotationValidityDays * 86400000).toISOString().slice(0, 10);
  return (
    <QuotationEditor
      initial={{
        leadId: searchParams.leadId ?? "",
        clientId: searchParams.clientId ?? "",
        validUntil,
        discountPct: "0",
        terms: settings.quotationTerms ?? "",
        items: [],
      }}
      leads={leads}
      clients={clients}
      discountLimit={DISCOUNT_LIMITS[role]}
    />
  );
}
