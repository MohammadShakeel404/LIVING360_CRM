import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { PaymentMethod } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildPaymentWhere } from "@/lib/paymentWhere";
import { refreshInvoiceStatus } from "@/lib/invoices";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "payments", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payments = await prisma.payment.findMany({
    where: buildPaymentWhere(req.nextUrl.searchParams),
    include: { invoice: { select: { id: true, invoiceNumber: true, client: { select: { id: true, name: true } } } } },
    orderBy: { paidAt: "desc" },
    take: 200,
  });
  const financial = can(session.user.role, "payments", "financial");
  return NextResponse.json({ payments: payments.map((p) => ({ ...p, amount: financial ? Number(p.amount) : null })) });
}

const createSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive("Amount must be more than 0"),
  method: z.nativeEnum(PaymentMethod),
  referenceNumber: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "payments", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment" }, { status: 422 });
  const data = parsed.data;

  const invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId }, include: { payments: { select: { amount: true } } } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "CANCELLED") return NextResponse.json({ error: "This invoice is cancelled." }, { status: 409 });

  const balance = Number(invoice.totalAmount) - invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  if (data.amount > balance + 0.5) {
    return NextResponse.json({ error: `That's more than the balance due (₹${balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}).` }, { status: 422 });
  }
  const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime()) || paidAt > new Date(Date.now() + 86400000)) {
    return NextResponse.json({ error: "Payment date can't be in the future." }, { status: 422 });
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: data.amount,
      method: data.method,
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || null,
      paidAt,
    },
  });
  // Recording a payment on a draft means it has effectively been issued.
  if (invoice.status === "DRAFT") await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "SENT" } });
  const result = await refreshInvoiceStatus(invoice.id);

  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "PAYMENT_LOGGED", entityType: "Payment", entityId: payment.id, metadata: { invoiceNumber: invoice.invoiceNumber, amount: data.amount } },
  });
  return NextResponse.json({ payment: { id: payment.id }, invoiceStatus: result?.status }, { status: 201 });
}
