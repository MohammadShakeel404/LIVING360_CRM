import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { assignmentInputSchema } from "@/lib/workers";
import { checkAssignment, assignmentData } from "@/lib/workerAssignments";

async function guard(action: "edit") {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!can(session.user.role, "workers", action) || !can(session.user.role, "workers", "financial")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Edit the work, rate / payable amount and stage plan. Stages that already have payments are kept. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard("edit");
  if (g.error) return g.error;
  const a = await prisma.projectWorker.findUnique({ where: { id: params.id }, include: { stages: true, payments: { select: { amount: true, stageId: true } } } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = assignmentInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid assignment" }, { status: 422 });
  const d = parsed.data;
  if (d.workerId !== a.workerId && a.payments.length) {
    return NextResponse.json({ error: "Payments are recorded for this worker — the worker can't be changed." }, { status: 409 });
  }
  const paid = a.payments.reduce((s, p) => s + Number(p.amount), 0);
  const check = await checkAssignment(d, paid);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: 422 });

  const keepIds = new Set(d.stages.map((s) => s.id).filter(Boolean));
  const removed = a.stages.filter((s) => !keepIds.has(s.id));
  const blocked = removed.find((s) => a.payments.some((p) => p.stageId === s.id));
  if (blocked) return NextResponse.json({ error: `Stage “${blocked.label}” has payments recorded and can't be removed.` }, { status: 409 });

  await prisma.$transaction([
    prisma.workerStage.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } }),
    ...d.stages.map((s, i) =>
      s.id && a.stages.some((x) => x.id === s.id)
        ? prisma.workerStage.update({ where: { id: s.id }, data: { label: s.label, amount: s.amount, sortOrder: i } })
        : prisma.workerStage.create({ data: { assignmentId: a.id, label: s.label, amount: s.amount, sortOrder: i } })
    ),
    prisma.projectWorker.update({ where: { id: a.id }, data: assignmentData(d, check.payable) }),
  ]);
  await prisma.activityLog.create({ data: { userId: g.session.user.id, action: "WORKER_ASSIGNMENT_EDITED", entityType: "ProjectWorker", entityId: a.id } });
  return NextResponse.json({ ok: true, message: "Work details updated." });
}

/** Mark the work completed / reopen it. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard("edit");
  if (g.error) return g.error;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "complete" && action !== "reopen") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const a = await prisma.projectWorker.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.projectWorker.update({
    where: { id: a.id },
    data: action === "complete" ? { status: "COMPLETED", endDate: new Date() } : { status: "ACTIVE", endDate: null },
  });
  return NextResponse.json({ ok: true, message: action === "complete" ? "Marked work as completed." : "Work reopened." });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Removing an assignment with no payments loses nothing, so editors may do it.
  const g = await guard("edit");
  if (g.error) return g.error;
  const a = await prisma.projectWorker.findUnique({ where: { id: params.id }, include: { _count: { select: { payments: true } } } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (a._count.payments) return NextResponse.json({ error: "Payments are recorded for this work. Remove the payments first, or mark the work completed." }, { status: 409 });
  await prisma.projectWorker.delete({ where: { id: a.id } });
  await prisma.activityLog.create({ data: { userId: g.session.user.id, action: "WORKER_UNASSIGNED", entityType: "ProjectWorker", entityId: a.id } });
  return NextResponse.json({ ok: true, message: "Worker removed from the project." });
}
