import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { SiteVisitsClient } from "./SiteVisitsClient";

export default async function SiteVisitsPage({ searchParams }: { searchParams: { leadId?: string; projectId?: string } }) {
  const session = await getServerSession(authOptions);
  const { role, id } = session!.user;
  if (!can(role, "sitevisits", "view")) return <EmptyState icon={Lock} title="No access" note="Your role doesn't have access to site visits." />;

  const own = role === "SALES_EXECUTIVE" || role === "SITE_SUPERVISOR";
  const [visits, leads, projects, users] = await Promise.all([
    prisma.siteVisit.findMany({
      where: own ? { OR: [{ assignedToId: id }, { lead: { assignedToId: id } }] } : {},
      include: {
        lead: { select: { id: true, name: true, projectLocation: true, phone: true } },
        project: { select: { id: true, projectNumber: true, siteLocation: true, client: { select: { name: true, phone: true } } } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 300,
    }),
    prisma.lead.findMany({
      where: { stage: { notIn: ["CONVERTED", "LOST"] }, ...(role === "SALES_EXECUTIVE" ? { assignedToId: id } : {}) },
      select: { id: true, name: true, leadNumber: true }, orderBy: { name: "asc" },
    }),
    prisma.project.findMany({ where: { stage: { not: "COMPLETED" } }, select: { id: true, projectNumber: true, client: { select: { name: true } } } }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <SiteVisitsClient
      canCreate={can(role, "sitevisits", "create")}
      canEdit={can(role, "sitevisits", "edit")}
      preset={searchParams.leadId ? `leadId:${searchParams.leadId}` : searchParams.projectId ? `projectId:${searchParams.projectId}` : ""}
      targets={[
        ...leads.map((l) => ({ value: `leadId:${l.id}`, label: `Lead · ${l.name} (${l.leadNumber})` })),
        ...projects.map((p) => ({ value: `projectId:${p.id}`, label: `Project · ${p.projectNumber} · ${p.client.name}` })),
      ]}
      users={users}
      visits={visits.map((v) => ({
        id: v.id,
        scheduledAt: v.scheduledAt.toISOString(),
        completedAt: v.completedAt?.toISOString() ?? null,
        title: v.lead?.name ?? (v.project ? `${v.project.client.name} · ${v.project.projectNumber}` : "—"),
        href: v.lead ? `/leads/${v.lead.id}` : v.project ? `/projects/${v.project.id}` : null,
        kind: v.lead ? "Lead" : "Project",
        location: v.lead?.projectLocation ?? v.project?.siteLocation ?? null,
        phone: v.lead?.phone ?? v.project?.client.phone ?? null,
        assignee: v.assignedTo?.name ?? null,
        assignedToId: v.assignedToId,
        notes: v.notes,
        measurements: (v.measurements as { text?: string } | null)?.text ?? null,
      }))}
    />
  );
}
