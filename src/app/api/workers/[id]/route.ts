import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { WorkerStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { workerInputSchema } from "@/lib/workers";

const patchSchema = workerInputSchema.partial().extend({ status: z.nativeEnum(WorkerStatus).optional() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "workers", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const worker = await prisma.worker.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 422 });
  const d = parsed.data;

  if (d.phone) {
    const digits = d.phone.replace(/\D/g, "").slice(-10);
    const dup = await prisma.worker.findFirst({ where: { phone: { contains: digits }, id: { not: worker.id } }, select: { name: true } });
    if (dup) return NextResponse.json({ error: `${dup.name} already has this phone number.` }, { status: 409 });
  }
  await prisma.worker.update({ where: { id: worker.id }, data: d });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "WORKER_UPDATED", entityType: "Worker", entityId: worker.id } });
  return NextResponse.json({ ok: true, message: d.status === "INACTIVE" ? "Worker marked inactive." : d.status === "ACTIVE" ? "Worker reactivated." : "Worker updated." });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "workers", "delete")) return NextResponse.json({ error: "Only an admin can delete workers." }, { status: 403 });

  const w = await prisma.worker.findUnique({ where: { id: params.id }, include: { _count: { select: { assignments: true } } } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (w._count.assignments) {
    return NextResponse.json({ error: "This worker has project history and payments. Mark them inactive instead so their records are kept." }, { status: 409 });
  }
  await prisma.worker.delete({ where: { id: w.id } });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "WORKER_DELETED", entityType: "Worker", entityId: w.id, metadata: { name: w.name } } });
  return NextResponse.json({ ok: true, message: `${w.name} deleted.` });
}
