import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Tasks + picker options for <TaskBoard>. */
export async function getTaskBoardData(where: Prisma.TaskWhereInput) {
  const [tasks, users, projects] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { assignee: { select: { name: true } }, project: { select: { projectNumber: true, client: { select: { name: true } } } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 300,
    }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { stage: { not: "COMPLETED" } }, select: { id: true, projectNumber: true, client: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    tasks: tasks.map((t) => ({
      id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null, projectId: t.projectId,
      projectNumber: t.project ? `${t.project.projectNumber} · ${t.project.client.name}` : null,
      assigneeId: t.assigneeId, assigneeName: t.assignee?.name ?? null,
    })),
    users: users.map((u) => ({ id: u.id, label: u.name })),
    projects: projects.map((p) => ({ id: p.id, label: `${p.projectNumber} · ${p.client.name}` })),
  };
}
