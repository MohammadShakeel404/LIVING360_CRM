import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { docRows } from "@/lib/documents";
import { EmptyState, PageHeader } from "@/components/ui";
import { DocumentsPanel } from "@/components/DocumentsPanel";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "documents", "view")) return <EmptyState icon={Lock} title="No access" note="Your role doesn't have access to documents." />;

  const [docs, projects, clients] = await Promise.all([
    docRows({}),
    prisma.project.findMany({ select: { id: true, projectNumber: true, client: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Documents" subtitle="Drawings, renders, site photos and agreements for every client and project." />
      <DocumentsPanel
        docs={docs}
        userId={session!.user.id}
        canUpload={can(role, "documents", "create")}
        canDeleteAll={can(role, "documents", "delete")}
        targets={[
          ...projects.map((p) => ({ value: `projectId:${p.id}`, label: `Project ${p.projectNumber} · ${p.client.name}` })),
          ...clients.map((c) => ({ value: `clientId:${c.id}`, label: `Client · ${c.name}` })),
        ]}
      />
    </div>
  );
}
