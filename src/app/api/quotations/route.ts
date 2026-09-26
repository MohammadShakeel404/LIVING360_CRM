import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildQuotationWhere } from "@/lib/quotationWhere";
import { quotationTotals } from "@/lib/totals";
import { nextNumber } from "@/lib/numbering";
import { getCompanySettings } from "@/lib/settings";
import { quotationInputSchema, needsApproval, itemRows } from "@/lib/quotationInput";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildQuotationWhere(req.nextUrl.searchParams);
  const scoped = session.user.role === "SALES_EXECUTIVE" ? { ...where, salespersonId: session.user.id } : where;

  const quotations = await prisma.quotation.findMany({
    where: scoped,
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      salesperson: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const financial = can(session.user.role, "quotations", "financial");
  const shaped = quotations.map(({ items, ...q }) => ({
    ...q,
    discountPct: q.discountPct.toString(),
    itemCount: items.length,
    grandTotal: financial ? quotationTotals(items, q.discountPct).grandTotal : null,
  }));

  return NextResponse.json({ quotations: shaped });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = quotationInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid quotation" }, { status: 422 });
  }
  const data = parsed.data;

  // Resolve the party: a lead that already converted is quoted against its client.
  let leadId = data.leadId || null;
  let clientId = data.clientId || null;
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { client: { select: { id: true } } } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    clientId = clientId ?? lead.client?.id ?? null;
  }
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { leadId: true } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    leadId = leadId ?? client.leadId;
  }
  if (!leadId && !clientId) return NextResponse.json({ error: "Choose a lead or client for this quotation." }, { status: 422 });

  const settings = await getCompanySettings();
  const validUntil = data.validUntil ? new Date(data.validUntil) : new Date(Date.now() + settings.quotationValidityDays * 86400000);
  const { requiresApproval } = needsApproval(session.user.role, data);
  const quotationNumber = await nextNumber("quotation", `QT-${new Date().getFullYear()}-`);

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber,
      salespersonId: session.user.id,
      leadId,
      clientId,
      validUntil,
      termsAndConditions: data.termsAndConditions?.trim() || settings.quotationTerms,
      discountPct: data.discountPct,
      requiresApproval,
      status: "DRAFT",
      items: { create: itemRows(data.items) },
    },
  });

  await prisma.activityLog.create({
    data: { userId: session.user.id, action: "QUOTATION_CREATED", entityType: "Quotation", entityId: quotation.id },
  });

  return NextResponse.json({ quotation: { id: quotation.id, quotationNumber }, requiresApproval }, { status: 201 });
}
