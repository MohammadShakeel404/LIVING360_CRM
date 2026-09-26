import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageContracts } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { CosEditor } from "../CosEditor";

export default async function NewCosPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!canManageContracts(session!.user.role)) return <EmptyState icon={Lock} title="No access" note="Only admins and project managers can raise a change of scope." />;
  const project = await prisma.project.findUnique({ where: { id: params.id }, include: { client: { select: { name: true } } } });
  if (!project) notFound();
  const [quotes, agreement] = await Promise.all([
    prisma.quotation.findMany({ where: { clientId: project.clientId, status: { in: ["APPROVED", "SENT"] } }, select: { id: true, quotationNumber: true }, orderBy: { createdAt: "desc" } }),
    prisma.agreement.findFirst({ where: { projectId: project.id, status: { not: "CANCELLED" } }, select: { quotationId: true } }),
  ]);
  return (
    <CosEditor
      projectId={project.id}
      projectLabel={`${project.projectNumber} · ${project.client.name}`}
      quotes={quotes.map((q) => ({ id: q.id, label: q.quotationNumber }))}
      initial={{ title: "", reason: "", quotationId: agreement?.quotationId ?? quotes[0]?.id ?? "", timeImpactDays: "0", items: [] }}
    />
  );
}
