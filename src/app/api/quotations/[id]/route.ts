import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, canApproveDiscount } from "@/lib/permissions";
import { quotationInputSchema, needsApproval, itemRows } from "@/lib/quotationInput";

/** Loads the quotation, enforcing Sales Executive row-level scoping. */
async function load(session: Session, id: string) {
  const q = await prisma.quotation.findUnique({ where: { id }, include: { items: true } });
  if (!q) return null;
  if (session.user.role === "SALES_EXECUTIVE" && q.salespersonId !== session.user.id) return null;
  return q;
}

const log = (userId: string, action: string, entityId: string, metadata?: object) =>
  prisma.activityLog.create({ data: { userId, action, entityType: "Quotation", entityId, metadata } });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = await load(session, params.id);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(session.user.role, "quotations", "financial")) q.items = [];
  return NextResponse.json({ quotation: q });
}

/** Full edit of a draft (items, discount, validity, terms). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = await load(session, params.id);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (q.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft quotations can be edited. Create a revision instead." }, { status: 409 });
  }

  const parsed = quotationInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid quotation" }, { status: 422 });
  const data = parsed.data;
  const { requiresApproval } = needsApproval(session.user.role, data);

  await prisma.$transaction([
    prisma.quotationItem.deleteMany({ where: { quotationId: q.id } }),
    prisma.quotation.update({
      where: { id: q.id },
      data: {
        validUntil: data.validUntil ? new Date(data.validUntil) : q.validUntil,
        termsAndConditions: data.termsAndConditions ?? q.termsAndConditions,
        discountPct: data.discountPct,
        requiresApproval,
        approvedById: requiresApproval ? null : q.approvedById,
        items: { create: itemRows(data.items) },
      },
    }),
  ]);
  await log(session.user.id, "QUOTATION_EDITED", q.id);
  return NextResponse.json({ ok: true, requiresApproval });
}

type Action = "approve" | "send" | "accept" | "reject" | "revise" | "reopen";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "quotations", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = await load(session, params.id);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { action } = (await req.json()) as { action: Action };
  const fail = (error: string, status = 409) => NextResponse.json({ error }, { status });

  switch (action) {
    case "approve": {
      if (!canApproveDiscount(role)) return fail("Only an Admin or Super Admin can approve discounts.", 403);
      if (!q.requiresApproval) return fail("This quotation doesn't need approval.");
      await prisma.quotation.update({ where: { id: q.id }, data: { requiresApproval: false, approvedById: session.user.id } });
      await log(session.user.id, "QUOTATION_DISCOUNT_APPROVED", q.id);
      return NextResponse.json({ ok: true, message: "Discount approved — the quotation can now be sent." });
    }
    case "send": {
      if (q.status !== "DRAFT") return fail("Only drafts can be marked as sent.");
      if (q.requiresApproval) return fail("The discount on this quotation needs admin approval before it can be sent.");
      await prisma.quotation.update({ where: { id: q.id }, data: { status: "SENT" } });
      // Move the lead forward in the pipeline if it's still earlier than "Quotation sent".
      if (q.leadId) {
        await prisma.lead.updateMany({
          where: { id: q.leadId, stage: { in: ["NEW_LEAD", "CONTACT_ATTEMPTED", "CONTACTED", "REQUIREMENT_DISCUSSED", "SITE_VISIT_SCHEDULED", "SITE_VISIT_COMPLETED", "PROPOSAL_DESIGN"] } },
          data: { stage: "QUOTATION_SENT" },
        });
      }
      await log(session.user.id, "QUOTATION_SENT", q.id);
      return NextResponse.json({ ok: true, message: "Marked as sent to client." });
    }
    case "accept": {
      if (!["SENT", "VIEWED"].includes(q.status)) return fail("Only sent quotations can be marked as accepted.");
      await prisma.quotation.update({ where: { id: q.id }, data: { status: "APPROVED" } });
      if (q.leadId) await prisma.lead.updateMany({ where: { id: q.leadId, stage: { notIn: ["CONVERTED"] } }, data: { stage: "NEGOTIATION" } });
      await log(session.user.id, "QUOTATION_ACCEPTED", q.id);
      return NextResponse.json({ ok: true, message: "Marked as accepted by the client." });
    }
    case "reject": {
      if (q.status === "DRAFT" && q.requiresApproval && !canApproveDiscount(role)) return fail("Only an admin can decline a pending discount.", 403);
      if (["APPROVED", "REJECTED"].includes(q.status)) return fail("This quotation is already closed.");
      await prisma.quotation.update({ where: { id: q.id }, data: { status: "REJECTED" } });
      await log(session.user.id, "QUOTATION_REJECTED", q.id);
      return NextResponse.json({ ok: true, message: "Marked as rejected." });
    }
    case "reopen": {
      if (!["REJECTED", "EXPIRED"].includes(q.status)) return fail("Only rejected or expired quotations can be reopened.");
      await prisma.quotation.update({ where: { id: q.id }, data: { status: "DRAFT" } });
      await log(session.user.id, "QUOTATION_REOPENED", q.id);
      return NextResponse.json({ ok: true, message: "Reopened as a draft." });
    }
    case "revise": {
      if (!can(role, "quotations", "create")) return fail("You can't create quotations.", 403);
      const existing = await prisma.quotation.findUnique({ where: { supersedesId: q.id }, select: { id: true } });
      if (existing) return NextResponse.json({ ok: true, id: existing.id, message: "A revision already exists." });
      const base = q.quotationNumber.replace(/-R\d+$/, "");
      const version = q.version + 1;
      const input = q.items.map((i) => ({ ...i, quantity: Number(i.quantity), rate: Number(i.rate), discountPct: Number(i.discountPct), gstPct: Number(i.gstPct) }));
      const { requiresApproval } = needsApproval(role, { items: input, discountPct: Number(q.discountPct) });
      const rev = await prisma.quotation.create({
        data: {
          quotationNumber: `${base}-R${version}`,
          version,
          supersedesId: q.id,
          leadId: q.leadId,
          clientId: q.clientId,
          salespersonId: session.user.id,
          validUntil: q.validUntil && q.validUntil > new Date() ? q.validUntil : new Date(Date.now() + 15 * 86400000),
          termsAndConditions: q.termsAndConditions,
          discountPct: q.discountPct,
          requiresApproval,
          items: { create: itemRows(input) },
        },
      });
      if (["DRAFT", "SENT", "VIEWED"].includes(q.status)) {
        await prisma.quotation.update({ where: { id: q.id }, data: { status: "EXPIRED" } });
      }
      await log(session.user.id, "QUOTATION_REVISED", rev.id, { from: q.quotationNumber });
      return NextResponse.json({ ok: true, id: rev.id, message: `Revision ${rev.quotationNumber} created.` });
    }
    default:
      return fail("Unknown action.", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invoices = await prisma.invoice.count({ where: { quotationId: params.id } });
  if (invoices) return NextResponse.json({ error: "This quotation has invoices raised against it and can't be deleted." }, { status: 409 });
  // A later revision points back at this one; detach it so the delete doesn't fail.
  await prisma.quotation.updateMany({ where: { supersedesId: params.id }, data: { supersedesId: null } });
  await prisma.quotation.delete({ where: { id: params.id } });
  await log(session.user.id, "QUOTATION_DELETED", params.id);
  return NextResponse.json({ ok: true });
}
