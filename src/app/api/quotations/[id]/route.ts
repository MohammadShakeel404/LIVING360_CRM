import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, DISCOUNT_LIMITS } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      lead: { select: { id: true, name: true, leadNumber: true } },
      salesperson: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ quotation });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const quotation = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Handle approval action
  if (body.action === "approve") {
    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json({ error: "Only Admin or Super Admin can approve quotations" }, { status: 403 });
    }
    const updated = await prisma.quotation.update({
      where: { id: params.id },
      data: { status: "APPROVED", approvedById: session.user.id, requiresApproval: false },
    });
    await prisma.activityLog.create({
      data: { userId: session.user.id, action: "QUOTATION_APPROVED", entityType: "Quotation", entityId: params.id },
    });
    return NextResponse.json({ quotation: updated });
  }

  // Handle reject action
  if (body.action === "reject") {
    const updated = await prisma.quotation.update({
      where: { id: params.id },
      data: { status: "REJECTED" },
    });
    await prisma.activityLog.create({
      data: { userId: session.user.id, action: "QUOTATION_REJECTED", entityType: "Quotation", entityId: params.id },
    });
    return NextResponse.json({ quotation: updated });
  }

  // Handle send action
  if (body.action === "send") {
    if (quotation.requiresApproval && quotation.status !== "APPROVED") {
      return NextResponse.json({ error: "This quotation requires approval before sending" }, { status: 400 });
    }
    const updated = await prisma.quotation.update({
      where: { id: params.id },
      data: { status: "SENT" },
    });
    return NextResponse.json({ quotation: updated });
  }

  // General update
  const updateData: any = {};
  if (body.status) updateData.status = body.status;
  if (body.validUntil) updateData.validUntil = new Date(body.validUntil);
  if (body.termsAndConditions !== undefined) updateData.termsAndConditions = body.termsAndConditions;

  const updated = await prisma.quotation.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json({ quotation: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.quotation.delete({ where: { id: params.id } });
  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "QUOTATION_DELETED", entityType: "Quotation", entityId: params.id },
  });

  return NextResponse.json({ success: true });
}
