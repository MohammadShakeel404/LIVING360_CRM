import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { ProjectStage } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const optDate = z.string().nullable().optional().transform((v) => (v === undefined ? undefined : v ? new Date(v) : null));
const schema = z.object({
  stage: z.nativeEnum(ProjectStage).optional(),
  projectManagerId: z.string().nullable().optional(),
  siteLocation: z.string().trim().max(300).nullable().optional(),
  startDate: optDate,
  expectedCompletion: optDate,
  budget: z.number().nonnegative().nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "projects", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, stage: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 422 });
  const data = parsed.data;
  if (!can(role, "projects", "financial")) { delete data.budget; delete data.value; }

  await prisma.project.update({ where: { id: existing.id }, data });
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: data.stage && data.stage !== existing.stage ? "PROJECT_STAGE_CHANGED" : "PROJECT_UPDATED",
      entityType: "Project", entityId: existing.id, metadata: { from: existing.stage, to: data.stage ?? existing.stage },
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "projects", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invoices = await prisma.invoice.count({ where: { projectId: params.id } });
  if (invoices) return NextResponse.json({ error: "This project has invoices and can't be deleted." }, { status: 409 });
  const workerPayments = await prisma.workerPayment.count({ where: { assignment: { projectId: params.id } } });
  if (workerPayments) return NextResponse.json({ error: "Worker payments are recorded on this project, so it can't be deleted." }, { status: 409 });
  await prisma.$transaction([
    prisma.task.deleteMany({ where: { projectId: params.id } }),
    prisma.siteVisit.deleteMany({ where: { projectId: params.id } }),
    prisma.document.deleteMany({ where: { projectId: params.id } }),
    prisma.project.delete({ where: { id: params.id } }),
  ]);
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "PROJECT_DELETED", entityType: "Project", entityId: params.id } });
  return NextResponse.json({ ok: true });
}
