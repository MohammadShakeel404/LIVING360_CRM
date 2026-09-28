import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { taskSchema } from "@/lib/taskInput";

/** Site supervisors and designers only work on tasks assigned to them. */
const OWN_ONLY = ["SITE_SUPERVISOR", "INTERIOR_DESIGNER"];

async function load(session: Session, id: string) {
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t || (OWN_ONLY.includes(session.user.role) && t.assigneeId !== session.user.id)) return null;
  return t;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "tasks", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const t = await load(session, params.id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = taskSchema.partial().safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid task" }, { status: 422 });
  const d = parsed.data;
  // Own-only roles can update progress but not reassign.
  if (OWN_ONLY.includes(session.user.role)) delete d.assigneeId;

  await prisma.task.update({
    where: { id: t.id },
    data: {
      ...d,
      description: d.description === undefined ? undefined : d.description || null,
      projectId: d.projectId === undefined ? undefined : d.projectId || null,
      assigneeId: d.assigneeId === undefined ? undefined : d.assigneeId || null,
      dueDate: d.dueDate === undefined ? undefined : d.dueDate ? new Date(d.dueDate) : null,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "tasks", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const t = await load(session, params.id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.task.delete({ where: { id: t.id } });
  return NextResponse.json({ ok: true });
}
