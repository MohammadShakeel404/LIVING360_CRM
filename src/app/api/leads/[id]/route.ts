import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { z } from "zod";
import { LeadScore, LeadSource, LeadStage } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

async function scopedLead(session: Session, id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || (session.user.role === "SALES_EXECUTIVE" && lead.assignedToId !== session.user.id)) return null;
  return lead;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "leads", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const lead = await scopedLead(session, params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(session.user.role, "leads", "financial")) Object.assign(lead, { budgetMin: null, budgetMax: null });
  return NextResponse.json({ lead });
}

const optText = z.string().trim().max(300).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));
const optDate = z.string().nullable().optional().transform((v) => (v === undefined ? undefined : v ? new Date(v) : null));
const optMoney = z.number().nonnegative().nullable().optional();

// Explicit allow-list: the client can never write arbitrary columns.
const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  whatsapp: optText, email: optText, location: optText, address: optText,
  source: z.nativeEnum(LeadSource).optional(),
  propertyType: optText, propertySize: optText,
  bedrooms: z.number().int().min(0).max(20).nullable().optional(),
  projectType: optText, projectLocation: optText,
  budgetMin: optMoney, budgetMax: optMoney,
  possessionDate: optDate, expectedStartDate: optDate,
  stage: z.nativeEnum(LeadStage).optional(),
  score: z.nativeEnum(LeadScore).optional(),
  lostReason: optText,
  assignedToId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "leads", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existing = await scopedLead(session, params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 422 });
  const data = parsed.data;

  if (data.stage === "CONVERTED" && existing.stage !== "CONVERTED") {
    return NextResponse.json({ error: "Use “Convert to client” to convert a lead." }, { status: 422 });
  }
  if (data.stage === "LOST" && !data.lostReason && !existing.lostReason) {
    return NextResponse.json({ error: "Add a reason when marking a lead as lost." }, { status: 422 });
  }
  if (!can(role, "leads", "financial")) { delete data.budgetMin; delete data.budgetMax; }
  // Only managers and above can reassign leads.
  if (data.assignedToId !== undefined && role === "SALES_EXECUTIVE") delete data.assignedToId;

  const lead = await prisma.lead.update({ where: { id: params.id }, data });
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: data.stage && data.stage !== existing.stage ? "LEAD_STAGE_CHANGED" : "LEAD_UPDATED",
      entityType: "Lead", entityId: lead.id,
      metadata: { fields: Object.keys(data), from: existing.stage, to: data.stage ?? existing.stage },
    },
  });
  return NextResponse.json({ lead });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "leads", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [client, quotations] = await Promise.all([
    prisma.client.count({ where: { leadId: params.id } }),
    prisma.quotation.count({ where: { leadId: params.id } }),
  ]);
  if (client || quotations) {
    return NextResponse.json({ error: "This lead has quotations or is already a client — mark it Lost instead of deleting." }, { status: 409 });
  }
  await prisma.$transaction([
    prisma.siteVisit.deleteMany({ where: { leadId: params.id } }),
    prisma.document.deleteMany({ where: { leadId: params.id } }),
    prisma.lead.delete({ where: { id: params.id } }),
  ]);
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "LEAD_DELETED", entityType: "Lead", entityId: params.id } });
  return NextResponse.json({ ok: true });
}
