import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const schema = z.object({
  leadId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  scheduledAt: z.string().min(1, "Pick a date and time"),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "sitevisits", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid visit" }, { status: 422 });
  const d = parsed.data;
  if (!d.leadId && !d.projectId) return NextResponse.json({ error: "Choose a lead or project." }, { status: 422 });
  const when = new Date(d.scheduledAt);
  if (Number.isNaN(when.getTime())) return NextResponse.json({ error: "Invalid date." }, { status: 422 });

  const visit = await prisma.siteVisit.create({
    data: { leadId: d.leadId || null, projectId: d.projectId || null, scheduledAt: when, assignedToId: d.assignedToId || session.user.id, notes: d.notes || null },
  });
  if (d.leadId) {
    await prisma.lead.updateMany({
      where: { id: d.leadId, stage: { in: ["NEW_LEAD", "CONTACT_ATTEMPTED", "CONTACTED", "REQUIREMENT_DISCUSSED"] } },
      data: { stage: "SITE_VISIT_SCHEDULED" },
    });
  }
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "SITE_VISIT_SCHEDULED", entityType: "SiteVisit", entityId: visit.id } });
  return NextResponse.json({ visit: { id: visit.id } }, { status: 201 });
}
