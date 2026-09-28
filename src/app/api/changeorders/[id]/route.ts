import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageContracts } from "@/lib/permissions";
import { cosInputSchema, cosItemRows, changeOrderTotals } from "@/lib/contracts";

const log = (userId: string, action: string, entityId: string) => prisma.activityLog.create({ data: { userId, action, entityType: "ChangeOrder", entityId } });

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageContracts(session.user.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

/** Full edit while still a draft. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.error) return g.error;
  const c = await prisma.changeOrder.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "DRAFT") return NextResponse.json({ error: "Only draft changes of scope can be edited." }, { status: 409 });
  const parsed = cosInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid change of scope" }, { status: 422 });
  const d = parsed.data;

  await prisma.$transaction([
    prisma.changeOrderItem.deleteMany({ where: { changeOrderId: c.id } }),
    prisma.changeOrder.update({
      where: { id: c.id },
      data: { title: d.title, reason: d.reason || null, timeImpactDays: d.timeImpactDays, quotationId: d.quotationId || null, items: { create: cosItemRows(d.items) } },
    }),
  ]);
  await log(g.session.user.id, "COS_EDITED", c.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.error) return g.error;
  const c = await prisma.changeOrder.findUnique({ where: { id: params.id }, include: { items: true, project: true } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const fail = (error: string) => NextResponse.json({ error }, { status: 409 });

  if (action === "send") {
    if (c.status !== "DRAFT") return fail("Only drafts can be sent.");
    await prisma.changeOrder.update({ where: { id: c.id }, data: { status: "SENT" } });
  } else if (action === "approve") {
    if (!["DRAFT", "SENT"].includes(c.status)) return fail("This change of scope is already closed.");
    // Approval revises the project's value and target date.
    const net = changeOrderTotals(c.items).net;
    const agreement = await prisma.agreement.findFirst({ where: { projectId: c.projectId, status: { not: "CANCELLED" } }, select: { contractValue: true } });
    const base = c.project.value ?? agreement?.contractValue ?? new Prisma.Decimal(0);
    await prisma.$transaction([
      prisma.changeOrder.update({ where: { id: c.id }, data: { status: "APPROVED", approvedAt: new Date() } }),
      prisma.project.update({
        where: { id: c.projectId },
        data: {
          value: Number(base) + net,
          expectedCompletion: c.project.expectedCompletion && c.timeImpactDays ? new Date(c.project.expectedCompletion.getTime() + c.timeImpactDays * 86400000) : undefined,
        },
      }),
    ]);
  } else if (action === "reject") {
    if (!["DRAFT", "SENT"].includes(c.status)) return fail("This change of scope is already closed.");
    await prisma.changeOrder.update({ where: { id: c.id }, data: { status: "REJECTED" } });
  } else if (action === "reopen") {
    if (c.status !== "REJECTED") return fail("Only rejected changes can be reopened.");
    await prisma.changeOrder.update({ where: { id: c.id }, data: { status: "DRAFT" } });
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  await log(g.session.user.id, `COS_${action.toUpperCase()}`, c.id);
  const messages: Record<string, string> = {
    send: "Marked as sent to the client.",
    approve: "Approved — project value and timeline updated.",
    reject: "Marked as rejected.",
    reopen: "Reopened as draft.",
  };
  return NextResponse.json({ ok: true, message: messages[action] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.error) return g.error;
  const c = await prisma.changeOrder.findUnique({ where: { id: params.id }, include: { _count: { select: { invoices: true } } } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status === "APPROVED") return NextResponse.json({ error: "Approved changes of scope can't be deleted." }, { status: 409 });
  if (c._count.invoices) return NextResponse.json({ error: "This change of scope has invoices." }, { status: 409 });
  await prisma.changeOrder.delete({ where: { id: c.id } });
  await log(g.session.user.id, "COS_DELETED", c.id);
  return NextResponse.json({ ok: true });
}
