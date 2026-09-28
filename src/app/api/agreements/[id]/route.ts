import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageContracts } from "@/lib/permissions";
import { quotationTotals } from "@/lib/totals";
import { agreementInputSchema } from "@/lib/contracts";

const date = (v?: string | null) => (v ? new Date(v) : null);
const log = (userId: string, action: string, entityId: string) => prisma.activityLog.create({ data: { userId, action, entityType: "Agreement", entityId } });

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageContracts(session.user.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

/** Edit an agreement that hasn't been signed yet. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.error) return g.error;
  const a = await prisma.agreement.findUnique({ where: { id: params.id }, include: { project: { select: { clientId: true } } } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (a.status === "SIGNED" || a.status === "CANCELLED") return NextResponse.json({ error: "Signed or cancelled agreements can't be edited." }, { status: 409 });

  const parsed = agreementInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid agreement" }, { status: 422 });
  const d = parsed.data;
  const q = await prisma.quotation.findUnique({ where: { id: d.quotationId }, include: { items: true } });
  if (!q || q.clientId !== a.project.clientId || q.status !== "APPROVED") return NextResponse.json({ error: "Choose an accepted quotation of this client." }, { status: 422 });

  await prisma.agreement.update({
    where: { id: a.id },
    data: {
      quotationId: q.id,
      contractValue: quotationTotals(q.items, q.discountPct).grandTotal,
      agreementDate: date(d.agreementDate) ?? a.agreementDate,
      startDate: date(d.startDate),
      completionDate: date(d.completionDate),
      paymentSchedule: d.paymentSchedule,
      terms: d.terms || null,
      workOrderNotes: d.workOrderNotes || null,
      exclusions: d.exclusions || null,
    },
  });
  await log(g.session.user.id, "AGREEMENT_EDITED", a.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.error) return g.error;
  const a = await prisma.agreement.findUnique({ where: { id: params.id } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const fail = (error: string) => NextResponse.json({ error }, { status: 409 });

  const transitions: Record<string, { from: string[]; to: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED"; message: string }> = {
    send: { from: ["DRAFT"], to: "SENT", message: "Marked as sent to the client." },
    sign: { from: ["DRAFT", "SENT"], to: "SIGNED", message: "Agreement marked as signed." },
    cancel: { from: ["DRAFT", "SENT", "SIGNED"], to: "CANCELLED", message: "Agreement cancelled." },
    reopen: { from: ["CANCELLED"], to: "DRAFT", message: "Reopened as draft." },
  };
  const t = action ? transitions[action] : undefined;
  if (!t) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (!t.from.includes(a.status)) return fail(`Can't ${action} an agreement that is ${a.status.toLowerCase()}.`);
  if (action === "reopen") {
    const other = await prisma.agreement.count({ where: { projectId: a.projectId, status: { not: "CANCELLED" }, id: { not: a.id } } });
    if (other) return fail("This project already has another active agreement.");
  }

  await prisma.agreement.update({ where: { id: a.id }, data: { status: t.to, signedAt: t.to === "SIGNED" ? new Date() : t.to === "DRAFT" ? null : undefined } });
  await log(g.session.user.id, `AGREEMENT_${t.to}`, a.id);
  return NextResponse.json({ ok: true, message: t.message });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.error) return g.error;
  const a = await prisma.agreement.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (a.status === "SIGNED") return NextResponse.json({ error: "Signed agreements can't be deleted — cancel it instead." }, { status: 409 });
  await prisma.agreement.delete({ where: { id: a.id } });
  await log(g.session.user.id, "AGREEMENT_DELETED", a.id);
  return NextResponse.json({ ok: true });
}
