import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { nextNumber } from "@/lib/numbering";

/** Converts a lead into a client: creates the Client, links the lead's quotations, marks the lead CONVERTED. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "leads", "edit")) return NextResponse.json({ error: "You don't have permission to convert leads." }, { status: 403 });

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!lead || (role === "SALES_EXECUTIVE" && lead.assignedToId !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lead.client) return NextResponse.json({ client: lead.client, message: "Already a client." });

  const clientNumber = await nextNumber("client", "CL-", 1000);
  const client = await prisma.$transaction(async (tx) => {
    const c = await tx.client.create({
      data: { clientNumber, leadId: lead.id, name: lead.name, phone: lead.phone, email: lead.email, address: lead.address ?? lead.projectLocation },
    });
    await tx.quotation.updateMany({ where: { leadId: lead.id, clientId: null }, data: { clientId: c.id } });
    await tx.lead.update({ where: { id: lead.id }, data: { stage: "CONVERTED", nextFollowUpAt: null } });
    await tx.followUp.updateMany({ where: { leadId: lead.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
    await tx.activityLog.create({ data: { userId: session.user.id, action: "LEAD_CONVERTED", entityType: "Lead", entityId: lead.id, metadata: { clientId: c.id } } });
    return c;
  });

  return NextResponse.json({ client, message: `${lead.name} is now client ${clientNumber}.` }, { status: 201 });
}
