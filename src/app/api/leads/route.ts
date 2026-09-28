import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { LeadSource, LeadStage, LeadScore } from "@prisma/client";
import { z } from "zod";
import { buildLeadWhere } from "@/lib/leadWhere";
import { nextNumber } from "@/lib/numbering";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "leads", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildLeadWhere(req.nextUrl.searchParams);

  // Sales executives only see their own book; managers and above see everyone's.
  const scoped =
    session.user.role === "SALES_EXECUTIVE"
      ? { ...where, assignedToId: session.user.id }
      : where;

  const leads = await prisma.lead.findMany({
    where: scoped,
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const financial = can(session.user.role, "leads", "financial");
  const shaped = leads.map((l) => ({
    ...l,
    budgetMin: financial ? l.budgetMin : null,
    budgetMax: financial ? l.budgetMax : null,
  }));

  return NextResponse.json({ leads: shaped });
}

const createLeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(20),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.nativeEnum(LeadSource).default(LeadSource.OTHER),
  propertyType: z.string().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  projectLocation: z.string().optional(),
  location: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "leads", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid lead" }, { status: 422 });
  }
  const data = parsed.data;

  // Duplicate detection (item 34 of the brief) — warn on exact phone match rather than block.
  const digits = data.phone.replace(/\D/g, "").slice(-10);
  const dup = await prisma.lead.findFirst({ where: { phone: { contains: digits } }, select: { id: true, name: true } });

  const leadNumber = await nextNumber("lead", "LD-", 1000);

  const lead = await prisma.lead.create({
    data: {
      leadNumber,
      name: data.name,
      phone: data.phone,
      whatsapp: data.whatsapp || null,
      email: data.email || null,
      source: data.source,
      propertyType: data.propertyType || null,
      budgetMin: data.budgetMin ?? null,
      budgetMax: data.budgetMax ?? null,
      projectLocation: data.projectLocation || null,
      location: data.location || null,
      assignedToId: session.user.id,
      stage: LeadStage.NEW_LEAD,
      score: LeadScore.WARM,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "LEAD_CREATED",
      entityType: "Lead",
      entityId: lead.id,
    },
  });

  return NextResponse.json({ lead, duplicateWarning: dup ? { id: dup.id, name: dup.name } : null }, { status: 201 });
}
