import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageContracts } from "@/lib/permissions";
import { getCompanySettings } from "@/lib/settings";
import { quotationTotals } from "@/lib/totals";
import { parseSchedule, toDrafts, DEFAULT_AGREEMENT_TERMS } from "@/lib/contracts";
import { EmptyState, formatCurrency } from "@/components/ui";

import { AgreementEditor } from "./AgreementEditor";

const day = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Create the project's agreement, or edit the active one if it isn't signed yet. */
export default async function AgreementPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!canManageContracts(session!.user.role)) return <EmptyState icon={Lock} title="No access" note="Only admins and project managers can prepare agreements." />;

  const project = await prisma.project.findUnique({ where: { id: params.id }, include: { client: { select: { name: true } } } });
  if (!project) notFound();
  const [existing, quotes, settings] = await Promise.all([
    prisma.agreement.findFirst({ where: { projectId: project.id, status: { not: "CANCELLED" } } }),
    prisma.quotation.findMany({ where: { clientId: project.clientId, status: "APPROVED" }, include: { items: true }, orderBy: { createdAt: "desc" } }),
    getCompanySettings(),
  ]);
  if (existing?.status === "SIGNED") redirect(`/projects/${project.id}`);

  const options = quotes.map((q) => {
    const total = quotationTotals(q.items, q.discountPct).grandTotal;
    return { id: q.id, total, label: `${q.quotationNumber} · ${formatCurrency(total)}` };
  });

  return (
    <AgreementEditor
      projectId={project.id}
      projectLabel={`${project.projectNumber} · ${project.client.name}`}
      quotes={options}
      initial={
        existing
          ? {
              id: existing.id, quotationId: existing.quotationId, agreementDate: day(existing.agreementDate), startDate: day(existing.startDate),
              completionDate: day(existing.completionDate), schedule: toDrafts(parseSchedule(existing.paymentSchedule)),
              terms: existing.terms ?? settings.agreementTerms ?? DEFAULT_AGREEMENT_TERMS, workOrderNotes: existing.workOrderNotes ?? "", exclusions: existing.exclusions ?? "",
            }
          : {
              quotationId: options[0]?.id ?? "", agreementDate: day(new Date()), startDate: day(project.startDate), completionDate: day(project.expectedCompletion),
              schedule: toDrafts(parseSchedule(settings.paymentSchedule)), terms: settings.agreementTerms ?? DEFAULT_AGREEMENT_TERMS, workOrderNotes: "", exclusions: "",
            }
      }
    />
  );
}
