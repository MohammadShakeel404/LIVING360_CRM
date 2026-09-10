import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildInvoiceWhere } from "@/lib/invoiceWhere";
import { InvoiceType } from "@prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildInvoiceWhere(req.nextUrl.searchParams);

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      project: { select: { id: true, projectNumber: true, stage: true } },
      payments: { select: { amount: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const financial = can(session.user.role, "invoices", "financial");
  
  const shaped = invoices.map((inv) => {
    const totalPaid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Number(inv.totalAmount) - totalPaid;
    return {
      ...inv,
      totalAmount: financial ? inv.totalAmount.toString() : null,
      totalPaid: financial ? totalPaid.toString() : null,
      balance: financial ? balance.toString() : null,
      invoiceDate: inv.invoiceDate.toISOString(),
      dueDate: inv.dueDate?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ invoices: shaped });
}

const createSchema = z.object({
  clientId: z.string().min(1),
  quotationId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  type: z.nativeEnum(InvoiceType),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  totalAmount: z.number().positive(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const data = parsed.data;

  const count = await prisma.invoice.count();
  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${(count + 1).toString().padStart(4, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId: data.clientId,
      quotationId: data.quotationId || null,
      projectId: data.projectId || null,
      type: data.type,
      status: "DRAFT",
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      totalAmount: data.totalAmount,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: invoice.id,
    },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
