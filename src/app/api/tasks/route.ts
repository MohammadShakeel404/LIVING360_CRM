import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { taskSchema } from "@/lib/taskInput";


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "tasks", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = taskSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid task" }, { status: 422 });
  const d = parsed.data;
  const task = await prisma.task.create({
    data: {
      title: d.title, description: d.description || null, projectId: d.projectId || null,
      assigneeId: d.assigneeId || session.user.id, priority: d.priority, status: d.status,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
    },
  });
  return NextResponse.json({ task: { id: task.id } }, { status: 201 });
}
