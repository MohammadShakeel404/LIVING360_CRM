import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { FollowUpType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { syncNextFollowUp } from "@/lib/followups";

const schema = z.object({
  type: z.nativeEnum(FollowUpType),
  scheduledAt: z.string().min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
  // true = log an interaction that already happened; false = schedule a future one.
  completed: z.boolean().default(false),
  outcome: z.string().trim().max(300).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "followups", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { id: true, assignedToId: true, stage: true } });
  if (!lead || (session.user.role === "SALES_EXECUTIVE" && lead.assignedToId !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid follow-up" }, { status: 422 });
  const d = parsed.data;
  const when = new Date(d.scheduledAt);
  if (Number.isNaN(when.getTime())) return NextResponse.json({ error: "Pick a valid date and time." }, { status: 422 });

  const followUp = await prisma.followUp.create({
    data: {
      leadId: lead.id, type: d.type, scheduledAt: when, notes: d.notes || null, outcome: d.outcome || null,
      status: d.completed ? "COMPLETED" : "SCHEDULED", completedAt: d.completed ? new Date() : null,
      createdById: session.user.id,
    },
  });
  if (d.completed && lead.stage === "NEW_LEAD") await prisma.lead.update({ where: { id: lead.id }, data: { stage: "CONTACTED" } });
  await syncNextFollowUp(lead.id);
  return NextResponse.json({ followUp }, { status: 201 });
}
