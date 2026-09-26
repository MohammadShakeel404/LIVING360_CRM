import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage({ searchParams }: { searchParams: { new?: string; clientId?: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "projects", "view")) return <EmptyState icon={Lock} title="No access" note="Your role doesn't have access to projects." />;

  const financial = can(role, "projects", "financial");
  const canCreate = can(role, "projects", "create");
  const [projects, clients, managers] = await Promise.all([
    prisma.project.findMany({
      include: {
        client: { select: { name: true } },
        projectManager: { select: { name: true } },
        tasks: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    canCreate ? prisma.client.findMany({ select: { id: true, name: true, clientNumber: true }, orderBy: { name: "asc" } }) : [],
    canCreate ? prisma.user.findMany({ where: { status: "ACTIVE", role: { in: ["PROJECT_MANAGER", "ADMIN", "SUPER_ADMIN"] } }, select: { id: true, name: true } }) : [],
  ]);

  return (
    <ProjectsClient
      openNew={searchParams.new === "1"}
      defaultClientId={searchParams.clientId ?? ""}
      canCreate={canCreate}
      financial={financial}
      clients={clients}
      managers={managers}
      projects={projects.map((p) => ({
        id: p.id,
        projectNumber: p.projectNumber,
        clientName: p.client.name,
        manager: p.projectManager?.name ?? null,
        siteLocation: p.siteLocation,
        stage: p.stage,
        expectedCompletion: p.expectedCompletion?.toISOString() ?? null,
        value: financial && p.value ? Number(p.value) : null,
        tasksOpen: p.tasks.filter((t) => t.status !== "COMPLETED").length,
        tasksTotal: p.tasks.length,
      }))}
    />
  );
}
