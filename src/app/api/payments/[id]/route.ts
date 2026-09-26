import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { refreshInvoiceStatus } from "@/lib/invoices";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "payments", "delete")) return NextResponse.json({ error: "Only admins can remove payments." }, { status: 403 });

  const payment = await prisma.payment.findUnique({ where: { id: params.id }, select: { id: true, invoiceId: true, amount: true } });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.payment.delete({ where: { id: payment.id } });
  await refreshInvoiceStatus(payment.invoiceId);
  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "PAYMENT_DELETED", entityType: "Payment", entityId: payment.id, metadata: { invoiceId: payment.invoiceId, amount: Number(payment.amount) } },
  });
  return NextResponse.json({ ok: true });
}
