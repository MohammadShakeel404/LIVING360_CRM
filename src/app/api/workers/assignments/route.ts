import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { assignmentInputSchema } from "@/lib/workers";
import { checkAssignment, assignmentData } from "@/lib/workerAssignments";

const createSchema = z.intersection(assignmentInputSchema, z.object({ projectId: z.string().min(1) }));

/** Engage a worker on a project with an agreed payable amount (and optional stage plan). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "workers", "create") || !can(role, "workers", "financial")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid assignment" }, { status: 422 });
  const d = parsed.data;
  const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const check = await checkAssignment(d);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: 422 });

  const a = await prisma.projectWorker.create({
    data: {
      ...assignmentData(d, check.payable),
      projectId: project.id,
      stages: { create: d.stages.map((s, i) => ({ label: s.label, amount: s.amount, sortOrder: i })) },
    },
    include: { worker: { select: { name: true } } },
  });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "WORKER_ASSIGNED", entityType: "ProjectWorker", entityId: a.id, metadata: { projectId: project.id, payable: check.payable } } });
  return NextResponse.json({ assignment: { id: a.id }, message: `${a.worker.name} added to the project.` }, { status: 201 });
}
