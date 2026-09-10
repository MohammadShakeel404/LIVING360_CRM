import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildPaymentWhere } from "@/lib/paymentWhere";
import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "payments", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildPaymentWhere(req.nextUrl.searchParams);

  const payments = await prisma.payment.findMany({
    where,
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          client: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { paidAt: "desc" },
    take: 200,
  });

  const financial = can(session.user.role, "payments", "financial");
  
  const shaped = payments.map((p) => ({
    ...p,
    amount: financial ? p.amount.toString() : null,
    paidAt: p.paidAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    invoice: {
      ...p.invoice,
      totalAmount: financial ? p.invoice.totalAmount.toString() : null,
    }
  }));

  return NextResponse.json({ payments: shaped });
}

const createSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "payments", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const data = parsed.data;

  // 1. Fetch the invoice to check balances and validate it exists
  const invoice = await prisma.invoice.findUnique({
    where: { id: data.invoiceId },
    include: { payments: true }
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // 2. Create the payment
  const payment = await prisma.payment.create({
    data: {
      invoiceId: data.invoiceId,
      amount: data.amount,
      method: data.method,
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || null,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
    },
  });

  // 3. Recalculate invoice status
  const existingPaymentsTotal = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const newTotalPaid = existingPaymentsTotal + data.amount;
  
  let newStatus = invoice.status;
  if (newTotalPaid >= Number(invoice.totalAmount)) {
    newStatus = "PAID";
  } else if (newTotalPaid > 0) {
    newStatus = "PARTIALLY_PAID";
  }

  // 4. Update the invoice status if it changed
  if (newStatus !== invoice.status) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: newStatus }
    });
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "PAYMENT_LOGGED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, amount: data.amount }
    },
  });

  return NextResponse.json({ payment, newInvoiceStatus: newStatus }, { status: 201 });
}
