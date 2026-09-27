import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextNumber } from "@/lib/numbering";
import { workerInputSchema } from "@/lib/workers";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "workers", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = workerInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid worker" }, { status: 422 });
  const d = parsed.data;

  const digits = d.phone.replace(/\D/g, "").slice(-10);
  const dup = await prisma.worker.findFirst({ where: { phone: { contains: digits } }, select: { name: true, workerNumber: true } });
  if (dup) return NextResponse.json({ error: `${dup.name} (${dup.workerNumber}) already has this phone number.` }, { status: 409 });

  const worker = await prisma.worker.create({
    data: { ...d, workerNumber: await nextNumber("worker", "WRK-") },
    select: { id: true, workerNumber: true, name: true },
  });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "WORKER_CREATED", entityType: "Worker", entityId: worker.id } });
  return NextResponse.json({ worker }, { status: 201 });
}
