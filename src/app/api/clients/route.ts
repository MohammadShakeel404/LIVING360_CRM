import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildClientWhere } from "@/lib/clientWhere";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "clients", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildClientWhere(req.nextUrl.searchParams);
  const clients = await prisma.client.findMany({
    where,
    include: {
      lead: { select: { propertyType: true, projectLocation: true, source: true } },
      projects: { select: { stage: true, value: true, projectManager: { select: { name: true } } } },
      invoices: { select: { totalAmount: true, status: true } },
    },
    orderBy: { convertedAt: "desc" },
    take: 200,
  });

  const financial = can(session.user.role, "clients", "financial");
  const shaped = clients.map((c) => ({
    ...c,
    projects: financial ? c.projects : c.projects.map((p) => ({ ...p, value: null })),
    invoices: financial ? c.invoices : [],
  }));

  return NextResponse.json({ clients: shaped });
}
