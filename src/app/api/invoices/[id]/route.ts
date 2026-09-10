import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { InvoiceStatus } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: any = {};
  if (body.status && Object.values(InvoiceStatus).includes(body.status)) {
    updateData.status = body.status;
  }
  if (body.dueDate) {
    updateData.dueDate = new Date(body.dueDate);
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: updateData,
  });

  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "INVOICE_UPDATED", entityType: "Invoice", entityId: params.id },
  });

  return NextResponse.json({ invoice: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.invoice.delete({ where: { id: params.id } });
  
  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "INVOICE_DELETED", entityType: "Invoice", entityId: params.id },
  });

  return NextResponse.json({ success: true });
}
