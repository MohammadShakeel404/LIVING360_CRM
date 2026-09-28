import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { assignmentSummary } from "@/lib/workers";
import { EmptyState } from "@/components/ui";
import { WorkersClient } from "./WorkersClient";

export default async function WorkersPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "workers", "view")) return <EmptyState icon={Lock} title="No access" note="Your role doesn't have access to workers." />;
  const financial = can(role, "workers", "financial");

  const workers = await prisma.worker.findMany({
    include: {
      assignments: {
        select: { status: true, agreedAmount: true, project: { select: { projectNumber: true, stage: true } }, payments: { select: { amount: true, stageId: true } } },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <WorkersClient
      financial={financial}
      canCreate={can(role, "workers", "create")}
      canExport={can(role, "workers", "export") && financial}
      workers={workers.map((w) => {
        const sums = w.assignments.map((a) => assignmentSummary(a));
        const active = w.assignments.filter((a) => a.status === "ACTIVE");
        return {
          id: w.id, workerNumber: w.workerNumber, name: w.name, trade: w.trade, phone: w.phone, status: w.status,
          activeProjects: active.map((a) => a.project.projectNumber),
          projects: w.assignments.length,
          payable: financial ? sums.reduce((s, x) => s + x.payable, 0) : null,
          paid: financial ? sums.reduce((s, x) => s + x.paid, 0) : null,
          balance: financial ? sums.reduce((s, x) => s + x.balance, 0) : null,
        };
      })}
    />
  );
}
