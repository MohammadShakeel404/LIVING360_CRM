import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

const schema = z.object({
  action: z.enum(["complete", "reschedule", "update"]),
  scheduledAt: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  measurements: z.string().trim().max(4000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "sitevisits", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const visit = await prisma.siteVisit.findUnique({ where: { id: params.id } });
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const when = d.scheduledAt ? new Date(d.scheduledAt) : undefined;
  if (when && Number.isNaN(when.getTime())) return NextResponse.json({ error: "Invalid date." }, { status: 422 });

  await prisma.siteVisit.update({
    where: { id: visit.id },
    data: {
      scheduledAt: when,
      assignedToId: d.assignedToId === undefined ? undefined : d.assignedToId || null,
      notes: d.notes === undefined ? undefined : d.notes || null,
      measurements: d.measurements === undefined ? undefined : d.measurements ? { text: d.measurements } : undefined,
      completedAt: d.action === "complete" ? new Date() : d.action === "reschedule" ? null : undefined,
    },
  });
  if (d.action === "complete" && visit.leadId) {
    await prisma.lead.updateMany({
      where: { id: visit.leadId, stage: { in: ["NEW_LEAD", "CONTACT_ATTEMPTED", "CONTACTED", "REQUIREMENT_DISCUSSED", "SITE_VISIT_SCHEDULED"] } },
      data: { stage: "SITE_VISIT_COMPLETED" },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "sitevisits", "delete") && !can(session.user.role, "sitevisits", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const visit = await prisma.siteVisit.findUnique({ where: { id: params.id }, select: { id: true, completedAt: true } });
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (visit.completedAt && !can(session.user.role, "sitevisits", "delete")) {
    return NextResponse.json({ error: "Completed visits can only be removed by an admin." }, { status: 403 });
  }
  await prisma.siteVisit.delete({ where: { id: visit.id } });
  return NextResponse.json({ ok: true });
}
