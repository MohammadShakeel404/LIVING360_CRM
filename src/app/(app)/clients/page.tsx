import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { Lock } from "lucide-react";
import { ClientsClient } from "./ClientsClient";

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;

  if (!can(role, "clients", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Your role doesn't have permission to view clients." />;
  }

  const financial = can(role, "clients", "financial");
  const clients = await prisma.client.findMany({
    include: {
      lead: { select: { propertyType: true } },
      projects: { select: { stage: true, value: true } },
    },
    orderBy: { convertedAt: "desc" },
    take: 200,
  });

  const shaped = clients.map((c) => ({
    id: c.id,
    clientNumber: c.clientNumber,
    name: c.name,
    propertyType: c.lead?.propertyType ?? null,
    projectStage: c.projects[0]?.stage ?? null,
    projectValue: financial && c.projects[0]?.value ? c.projects[0].value.toString() : null,
  }));

  return <ClientsClient clients={shaped} canExport={can(role, "clients", "export")} financialAccess={financial} />;
}
