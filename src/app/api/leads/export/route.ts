import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildExcelWorkbook, excelResponseHeaders, ExportColumn } from "@/lib/excel";
import { buildLeadWhere } from "@/lib/leadWhere";

type LeadRow = Awaited<ReturnType<typeof fetchLeads>>[number];

async function fetchLeads(where: NonNullable<Parameters<typeof prisma.lead.findMany>[0]>["where"]) {
  return prisma.lead.findMany({
    where,
    include: { assignedTo: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "leads", "export")) {
    return NextResponse.json({ error: "You don't have permission to export leads." }, { status: 403 });
  }

  const where = buildLeadWhere(req.nextUrl.searchParams);
  const scoped =
    session.user.role === "SALES_EXECUTIVE" ? { ...where, assignedToId: session.user.id } : where;

  const leads = await fetchLeads(scoped);
  const financial = can(session.user.role, "leads", "financial");

  const columns: ExportColumn<LeadRow>[] = [
    { header: "Lead ID", width: 12, value: (l) => l.leadNumber },
    { header: "Name", width: 24, value: (l) => l.name },
    { header: "Phone", width: 16, value: (l) => l.phone },
    { header: "Source", width: 14, value: (l) => l.source },
    { header: "Stage", width: 20, value: (l) => l.stage.replaceAll("_", " ") },
    { header: "Score", width: 10, value: (l) => l.score },
    ...(financial
      ? ([
          { header: "Budget Min", width: 14, value: (l) => (l.budgetMin ? Number(l.budgetMin) : ""), numFmt: "#,##0" },
          { header: "Budget Max", width: 14, value: (l) => (l.budgetMax ? Number(l.budgetMax) : ""), numFmt: "#,##0" },
        ] as ExportColumn<LeadRow>[])
      : []),
    { header: "Property Type", width: 20, value: (l) => l.propertyType ?? "" },
    { header: "Location", width: 22, value: (l) => l.projectLocation ?? l.location ?? "" },
    { header: "Assigned To", width: 20, value: (l) => l.assignedTo?.name ?? "Unassigned" },
    { header: "Next Follow-up", width: 20, value: (l) => l.nextFollowUpAt ?? "", numFmt: "dd-mmm-yyyy hh:mm" },
    { header: "Created", width: 18, value: (l) => l.createdAt, numFmt: "dd-mmm-yyyy" },
  ];

  const buffer = await buildExcelWorkbook({
    sheetName: "Leads",
    title: "Leads Export",
    subtitle: `Exported by ${session.user.name} on ${new Date().toLocaleString("en-IN")} · ${leads.length} record(s)`,
    columns,
    rows: leads,
  });

  const filename = `living360-leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as any, { headers: excelResponseHeaders(filename) });
}
