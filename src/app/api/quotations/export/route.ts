import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildQuotationWhere } from "@/lib/quotationWhere";
import { buildExcelWorkbook, excelResponseHeaders } from "@/lib/excel";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildQuotationWhere(req.nextUrl.searchParams);
  const scoped =
    session.user.role === "SALES_EXECUTIVE"
      ? { ...where, salespersonId: session.user.id }
      : where;

  const quotations = await prisma.quotation.findMany({
    where: scoped,
    include: {
      client: { select: { name: true } },
      lead: { select: { name: true } },
      salesperson: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const financial = can(session.user.role, "quotations", "financial");

  type Row = (typeof quotations)[number];
  const columns = [
    { header: "Quotation #", width: 18, value: (r: Row) => r.quotationNumber },
    { header: "Client", width: 22, value: (r: Row) => r.client?.name ?? r.lead?.name ?? "—" },
    { header: "Status", width: 14, value: (r: Row) => r.status },
    { header: "Items", width: 8, value: (r: Row) => r.items.length },
    { header: "Salesperson", width: 20, value: (r: Row) => r.salesperson.name },
    { header: "Created", width: 14, value: (r: Row) => r.createdAt },
    ...(financial
      ? [
          {
            header: "Total (excl. GST)",
            width: 18,
            value: (r: Row) =>
              r.items.reduce((sum, i) => {
                const base = Number(i.quantity) * Number(i.rate);
                const disc = base * (Number(i.discountPct) / 100);
                return sum + (base - disc);
              }, 0),
            numFmt: "₹#,##0",
          },
        ]
      : []),
  ];

  const buffer = await buildExcelWorkbook({
    sheetName: "Quotations",
    title: "Quotations Export",
    subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")}`,
    columns,
    rows: quotations,
  });

  return new NextResponse(buffer as any, { headers: excelResponseHeaders("Living360_Quotations.xlsx") });
}
