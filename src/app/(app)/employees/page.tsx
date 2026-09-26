import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, ROLE_LABEL, DISCOUNT_LIMITS } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { EmployeesClient } from "./EmployeesClient";

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "employees", "view")) return <EmptyState icon={Lock} title="No access" note="Employee management is for admins." />;

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true, joiningDate: true,
      _count: { select: { assignedLeads: true, tasksAssigned: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <EmployeesClient
      me={session!.user.id}
      isSuperAdmin={role === "SUPER_ADMIN"}
      canCreate={can(role, "employees", "create")}
      canEdit={can(role, "employees", "edit")}
      canDelete={can(role, "employees", "delete")}
      roles={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label, discount: DISCOUNT_LIMITS[value as keyof typeof DISCOUNT_LIMITS] }))}
      users={users.map((u) => ({
        id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, roleLabel: ROLE_LABEL[u.role], status: u.status,
        joiningDate: u.joiningDate.toISOString(), leads: u._count.assignedLeads, tasks: u._count.tasksAssigned,
      }))}
    />
  );
}
