import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, PriorityChip } from "@/components/ui";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  const scoped = ["SITE_SUPERVISOR", "INTERIOR_DESIGNER"].includes(session!.user.role)
    ? { assigneeId: session!.user.id }
    : {};

  const tasks = await prisma.task.findMany({
    where: scoped,
    include: { assignee: { select: { name: true } }, project: { select: { projectNumber: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink">Tasks</h1>
      <div className="flex flex-col gap-2.5">
        {tasks.length === 0 && <div className="text-[13.5px] text-ink-soft">No tasks assigned yet.</div>}
        {tasks.map((t) => (
          <div key={t.id} className="rounded-xl2 border border-line bg-white p-3.5">
            <div className="mb-2 flex items-start justify-between gap-3">
              <span className="text-[14px] font-semibold text-ink">{t.title}</span>
              <PriorityChip priority={t.priority} />
            </div>
            <div className="mb-2 text-xs text-ink-soft">{t.project?.projectNumber ?? "No project linked"}</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {t.assignee && <Avatar name={t.assignee.name} size={22} />}
                <span className="text-xs text-ink-soft">{t.assignee?.name ?? "Unassigned"}</span>
              </div>
              <span className="text-xs font-medium text-ink-faint">
                {t.dueDate ? `Due ${t.dueDate.toLocaleDateString("en-IN")}` : "No due date"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
