import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildInvoiceWhere } from "@/lib/invoiceWhere";
import { nextNumber } from "@/lib/numbering";
import { invoiceInputSchema, invoiceItemRows, checkInvoiceInput, effectiveInvoiceStatus } from "@/lib/invoices";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invoices = await prisma.invoice.findMany({
    where: buildInvoiceWhere(req.nextUrl.searchParams),
    include: {
      client: { select: { id: true, name: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const financial = can(session.user.role, "invoices", "financial");
  const shaped = invoices.map(({ payments, ...inv }) => {
    const total = Number(inv.totalAmount);
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    return {
      ...inv,
      status: effectiveInvoiceStatus(inv.status, total, paid, inv.dueDate),
      totalAmount: financial ? total : null,
      paid: financial ? paid : null,
      balance: financial ? Math.round(Math.max(total - paid, 0) * 100) / 100 : null,
    };
  });
  return NextResponse.json({ invoices: shaped });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "create") || !can(session.user.role, "invoices", "financial")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = invoiceInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid invoice" }, { status: 422 });
  const data = parsed.data;
  const check = await checkInvoiceInput(data);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: 422 });

  const invoiceNumber = await nextNumber("invoice", `INV-${new Date().getFullYear()}-`);
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId: data.clientId,
      quotationId: data.quotationId || null,
      projectId: data.projectId || null,
        changeOrderId: data.changeOrderId || null,
      type: data.type,
      status: "DRAFT",
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes || null,
      totalAmount: check.total,
      items: { create: invoiceItemRows(data.items) },
    },
  });

  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "INVOICE_CREATED", entityType: "Invoice", entityId: invoice.id, metadata: { total: check.total } },
  });
  return NextResponse.json({ invoice: { id: invoice.id, invoiceNumber } }, { status: 201 });
}
