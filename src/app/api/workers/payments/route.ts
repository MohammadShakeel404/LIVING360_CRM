import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextNumber } from "@/lib/numbering";
import { workerPaymentSchema, assignmentSummary } from "@/lib/workers";

const inr = (v: number) => "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** Record a payment made to a worker — against a stage, or direct / advance. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "workers", "create") || !can(role, "workers", "financial")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = workerPaymentSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment" }, { status: 422 });
  const d = parsed.data;

  const a = await prisma.projectWorker.findUnique({
    where: { id: d.assignmentId },
    include: { stages: true, payments: { select: { amount: true, stageId: true } }, worker: { select: { name: true } } },
  });
  if (!a) return NextResponse.json({ error: "Work assignment not found" }, { status: 404 });
  if (d.stageId && !a.stages.some((s) => s.id === d.stageId)) return NextResponse.json({ error: "That stage belongs to different work." }, { status: 422 });

  const sum = assignmentSummary(a);
  if (d.amount > sum.balance + 0.5) {
    return NextResponse.json({
      error: sum.balance > 0
        ? `That's more than the ${inr(sum.balance)} still payable to ${a.worker.name}. If extra work was done, edit the work and increase the payable amount first.`
        : `${a.worker.name} is already fully paid for this work. Increase the payable amount first if extra work was done.`,
    }, { status: 422 });
  }
  const paidAt = d.paidAt ? new Date(d.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime()) || paidAt > new Date(Date.now() + 86400000)) return NextResponse.json({ error: "Payment date can't be in the future." }, { status: 422 });

  const payment = await prisma.workerPayment.create({
    data: {
      receiptNumber: await nextNumber("workerPayment", `WP-${paidAt.getFullYear()}-`),
      assignmentId: a.id,
      stageId: d.stageId || null,
      amount: d.amount,
      method: d.method,
      referenceNumber: d.referenceNumber || null,
      notes: d.notes || null,
      paidAt,
      recordedById: session.user.id,
    },
    select: { id: true, receiptNumber: true },
  });
  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "WORKER_PAID", entityType: "WorkerPayment", entityId: payment.id, metadata: { assignmentId: a.id, amount: d.amount } },
  });
  return NextResponse.json({ payment, message: `Paid ${inr(d.amount)} to ${a.worker.name} — receipt ${payment.receiptNumber}.` }, { status: 201 });
}
