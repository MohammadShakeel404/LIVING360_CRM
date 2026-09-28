import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageContracts } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { CosEditor } from "../../CosEditor";

export default async function EditCosPage({ params }: { params: { id: string; cosId: string } }) {
  const session = await getServerSession(authOptions);
  if (!canManageContracts(session!.user.role)) return <EmptyState icon={Lock} title="No access" note="Only admins and project managers can edit a change of scope." />;
  const c = await prisma.changeOrder.findUnique({
    where: { id: params.cosId },
    include: { items: { orderBy: { sortOrder: "asc" } }, project: { include: { client: { select: { name: true } } } } },
  });
  if (!c || c.projectId !== params.id) notFound();
  if (c.status !== "DRAFT") redirect(`/projects/${c.projectId}/cos/${c.id}`);
  const quotes = await prisma.quotation.findMany({ where: { clientId: c.project.clientId, status: { in: ["APPROVED", "SENT"] } }, select: { id: true, quotationNumber: true } });
  return (
    <CosEditor
      projectId={c.projectId}
      projectLabel={`${c.cosNumber} · ${c.project.projectNumber} · ${c.project.client.name}`}
      quotes={quotes.map((q) => ({ id: q.id, label: q.quotationNumber }))}
      initial={{
        id: c.id, title: c.title, reason: c.reason ?? "", quotationId: c.quotationId ?? "", timeImpactDays: String(c.timeImpactDays),
        items: c.items.map((i) => ({
          deduction: i.deduction, category: i.category, name: i.name, description: i.description ?? "", quantity: i.quantity.toString(),
          unit: i.unit, rate: i.rate.toString(), gstPct: String(Number(i.gstPct)),
        })),
      }}
    />
  );
}
