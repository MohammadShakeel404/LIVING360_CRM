import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { invoiceInputSchema, invoiceItemRows, checkInvoiceInput, refreshInvoiceStatus } from "@/lib/invoices";

const log = (userId: string, action: string, entityId: string) =>
  prisma.activityLog.create({ data: { userId, action, entityType: "Invoice", entityId } });

/** Full edit of a draft invoice. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "edit") || !can(session.user.role, "invoices", "financial")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const inv = await prisma.invoice.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inv.status !== "DRAFT") return NextResponse.json({ error: "Only draft invoices can be edited." }, { status: 409 });

  const parsed = invoiceInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid invoice" }, { status: 422 });
  const data = parsed.data;
  const check = await checkInvoiceInput(data, inv.id);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: 422 });

  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: inv.id } }),
    prisma.invoice.update({
      where: { id: inv.id },
      data: {
        clientId: data.clientId,
        quotationId: data.quotationId || null,
        projectId: data.projectId || null,
        changeOrderId: data.changeOrderId || null,
        type: data.type,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes || null,
        totalAmount: check.total,
        items: { create: invoiceItemRows(data.items) },
      },
    }),
  ]);
  await log(session.user.id, "INVOICE_EDITED", inv.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const inv = await prisma.invoice.findUnique({ where: { id: params.id }, include: { _count: { select: { payments: true } } } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { action, dueDate } = (await req.json()) as { action: "send" | "cancel" | "reopen" | "dueDate"; dueDate?: string };

  if (action === "send") {
    if (inv.status !== "DRAFT") return NextResponse.json({ error: "Only drafts can be issued." }, { status: 409 });
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "SENT" } });
    await refreshInvoiceStatus(inv.id);
    await log(session.user.id, "INVOICE_ISSUED", inv.id);
    return NextResponse.json({ ok: true, message: "Invoice issued to client." });
  }
  if (action === "cancel") {
    if (inv._count.payments) return NextResponse.json({ error: "Remove the recorded payments before cancelling this invoice." }, { status: 409 });
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "CANCELLED" } });
    await log(session.user.id, "INVOICE_CANCELLED", inv.id);
    return NextResponse.json({ ok: true, message: "Invoice cancelled." });
  }
  if (action === "reopen") {
    if (inv.status !== "CANCELLED") return NextResponse.json({ error: "Only cancelled invoices can be reopened." }, { status: 409 });
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "DRAFT" } });
    await log(session.user.id, "INVOICE_REOPENED", inv.id);
    return NextResponse.json({ ok: true, message: "Reopened as draft." });
  }
  if (action === "dueDate") {
    const d = dueDate ? new Date(dueDate) : null;
    if (d && Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid date." }, { status: 422 });
    await prisma.invoice.update({ where: { id: inv.id }, data: { dueDate: d } });
    return NextResponse.json({ ok: true, message: "Due date updated." });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const inv = await prisma.invoice.findUnique({ where: { id: params.id }, include: { _count: { select: { payments: true } } } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inv._count.payments) return NextResponse.json({ error: "This invoice has payments recorded — cancel it instead." }, { status: 409 });

  await prisma.invoice.delete({ where: { id: params.id } });
  await log(session.user.id, "INVOICE_DELETED", params.id);
  return NextResponse.json({ ok: true });
}
