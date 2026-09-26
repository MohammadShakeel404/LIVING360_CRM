import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextNumber } from "@/lib/numbering";
import { quotationTotals } from "@/lib/totals";

const schema = z.object({
  clientId: z.string().min(1, "Choose a client"),
  projectManagerId: z.string().nullable().optional(),
  siteLocation: z.string().trim().max(300).nullable().optional(),
  startDate: z.string().nullable().optional(),
  expectedCompletion: z.string().nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "projects", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid project" }, { status: 422 });
  const d = parsed.data;
  const client = await prisma.client.findUnique({
    where: { id: d.clientId },
    include: { lead: { select: { projectLocation: true } }, quotations: { where: { status: "APPROVED" }, include: { items: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Default the contract value to the latest accepted quotation.
  const accepted = client.quotations[0];
  const value = d.value ?? (accepted ? quotationTotals(accepted.items, accepted.discountPct).grandTotal : null);

  const project = await prisma.project.create({
    data: {
      projectNumber: await nextNumber("project", "PRJ-", 1000),
      clientId: client.id,
      projectManagerId: d.projectManagerId || null,
      siteLocation: d.siteLocation || client.address || client.lead?.projectLocation || null,
      startDate: d.startDate ? new Date(d.startDate) : new Date(),
      expectedCompletion: d.expectedCompletion ? new Date(d.expectedCompletion) : null,
      budget: can(session.user.role, "projects", "financial") ? d.budget ?? null : null,
      value: can(session.user.role, "projects", "financial") ? value : null,
    },
  });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "PROJECT_CREATED", entityType: "Project", entityId: project.id } });
  return NextResponse.json({ project: { id: project.id, projectNumber: project.projectNumber } }, { status: 201 });
}
