import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "workers", "delete")) return NextResponse.json({ error: "Only an admin can remove a recorded payment." }, { status: 403 });

  const p = await prisma.workerPayment.findUnique({ where: { id: params.id }, select: { id: true, receiptNumber: true, amount: true, assignmentId: true } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.workerPayment.delete({ where: { id: p.id } });
  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "WORKER_PAYMENT_DELETED", entityType: "WorkerPayment", entityId: p.id, metadata: { receipt: p.receiptNumber, amount: Number(p.amount), assignmentId: p.assignmentId } },
  });
  return NextResponse.json({ ok: true, message: `Payment ${p.receiptNumber} removed.` });
}
