import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getTaskBoardData } from "@/lib/taskBoard";
import { EmptyState, PageHeader } from "@/components/ui";
import { TaskBoard } from "@/components/TaskBoard";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "tasks", "view")) return <EmptyState icon={Lock} title="No access" note="Your role doesn't have access to tasks." />;

  const ownOnly = role === "SITE_SUPERVISOR" || role === "INTERIOR_DESIGNER";
  const data = await getTaskBoardData(ownOnly ? { assigneeId: session!.user.id } : {});
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Tasks" subtitle={ownOnly ? "Tasks assigned to you." : "Everything the team is working on."} />
      <TaskBoard {...data} canCreate={can(role, "tasks", "create")} canEdit={can(role, "tasks", "edit")} canDelete={can(role, "tasks", "delete")} />
    </div>
  );
}
