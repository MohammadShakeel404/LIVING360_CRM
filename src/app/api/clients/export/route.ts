import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildExcelWorkbook, excelResponseHeaders, ExportColumn } from "@/lib/excel";
import { buildClientWhere } from "@/lib/clientWhere";

async function fetchClients(where: NonNullable<Parameters<typeof prisma.client.findMany>[0]>["where"]) {
  return prisma.client.findMany({
    where,
    include: {
      lead: { select: { propertyType: true, projectLocation: true, source: true } },
      projects: { select: { stage: true, value: true, projectManager: { select: { name: true } } } },
      invoices: { select: { totalAmount: true, status: true } },
    },
    orderBy: { convertedAt: "desc" },
  });
}
type ClientRow = Awaited<ReturnType<typeof fetchClients>>[number];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "clients", "export")) {
    return NextResponse.json({ error: "You don't have permission to export clients." }, { status: 403 });
  }

  const where = buildClientWhere(req.nextUrl.searchParams);
  const clients = await fetchClients(where);
  const financial = can(session.user.role, "clients", "financial");

  const columns: ExportColumn<ClientRow>[] = [
    { header: "Client ID", width: 12, value: (c) => c.clientNumber },
    { header: "Name", width: 24, value: (c) => c.name },
    { header: "Phone", width: 16, value: (c) => c.phone },
    { header: "Property Type", width: 20, value: (c) => c.lead?.propertyType ?? "" },
    { header: "Location", width: 22, value: (c) => c.lead?.projectLocation ?? "" },
    { header: "Source", width: 14, value: (c) => c.lead?.source ?? "" },
    { header: "Project Stage", width: 18, value: (c) => c.projects[0]?.stage?.replaceAll("_", " ") ?? "Not started" },
    { header: "Project Manager", width: 20, value: (c) => c.projects[0]?.projectManager?.name ?? "Unassigned" },
    ...(financial
      ? ([
          { header: "Project Value", width: 16, value: (c) => (c.projects[0]?.value ? Number(c.projects[0].value) : ""), numFmt: "#,##0" },
          {
            header: "Invoiced",
            width: 14,
            value: (c) => c.invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
            numFmt: "#,##0",
          },
        ] as ExportColumn<ClientRow>[])
      : []),
    { header: "Client Since", width: 16, value: (c) => c.convertedAt, numFmt: "dd-mmm-yyyy" },
  ];

  const buffer = await buildExcelWorkbook({
    sheetName: "Clients",
    title: "Clients Export",
    subtitle: `Exported by ${session.user.name} on ${new Date().toLocaleString("en-IN")} · ${clients.length} record(s)`,
    columns,
    rows: clients,
  });

  const filename = `living360-clients-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as any, { headers: excelResponseHeaders(filename) });
}
