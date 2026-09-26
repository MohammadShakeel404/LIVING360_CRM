import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { syncNextFollowUp } from "@/lib/followups";

const schema = z.object({
  action: z.enum(["complete", "cancel", "reschedule"]),
  outcome: z.string().trim().max(300).optional().nullable(),
  scheduledAt: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "followups", "edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const f = await prisma.followUp.findUnique({ where: { id: params.id }, include: { lead: { select: { id: true, assignedToId: true, stage: true } } } });
  if (!f || (session.user.role === "SALES_EXECUTIVE" && f.lead.assignedToId !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  const { action, outcome, scheduledAt } = parsed.data;

  if (action === "reschedule") {
    const when = scheduledAt ? new Date(scheduledAt) : null;
    if (!when || Number.isNaN(when.getTime())) return NextResponse.json({ error: "Pick a new date and time." }, { status: 422 });
    await prisma.followUp.update({ where: { id: f.id }, data: { scheduledAt: when, status: "SCHEDULED" } });
  } else if (action === "complete") {
    await prisma.followUp.update({ where: { id: f.id }, data: { status: "COMPLETED", completedAt: new Date(), outcome: outcome || f.outcome } });
    if (f.lead.stage === "NEW_LEAD") await prisma.lead.update({ where: { id: f.lead.id }, data: { stage: "CONTACTED" } });
  } else {
    await prisma.followUp.update({ where: { id: f.id }, data: { status: "CANCELLED" } });
  }

  await syncNextFollowUp(f.lead.id);
  return NextResponse.json({ ok: true });
}
