import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildExcelWorkbook, excelResponseHeaders, ExportColumn } from "@/lib/excel";
import { buildInvoiceWhere } from "@/lib/invoiceWhere";

async function fetchInvoices(where: NonNullable<Parameters<typeof prisma.invoice.findMany>[0]>["where"]) {
  return prisma.invoice.findMany({
    where,
    include: {
      client: { select: { name: true } },
      project: { select: { projectNumber: true } },
      payments: { select: { amount: true } }
    },
    orderBy: { createdAt: "desc" },
  });
}
type InvoiceRow = Awaited<ReturnType<typeof fetchInvoices>>[number];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "invoices", "export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildInvoiceWhere(req.nextUrl.searchParams);
  const invoices = await fetchInvoices(where);
  const financial = can(session.user.role, "invoices", "financial");

  const columns: ExportColumn<InvoiceRow>[] = [
    { header: "Invoice #", width: 18, value: (i) => i.invoiceNumber },
    { header: "Client", width: 24, value: (i) => i.client.name },
    { header: "Type", width: 16, value: (i) => i.type.replaceAll("_", " ") },
    { header: "Status", width: 16, value: (i) => i.status.replaceAll("_", " ") },
    { header: "Project #", width: 18, value: (i) => i.project?.projectNumber ?? "—" },
    { header: "Invoice Date", width: 16, value: (i) => i.invoiceDate, numFmt: "dd-mmm-yyyy" },
    { header: "Due Date", width: 16, value: (i) => i.dueDate, numFmt: "dd-mmm-yyyy" },
    ...(financial
      ? ([
          { header: "Total Amount", width: 18, value: (i) => Number(i.totalAmount), numFmt: "₹#,##0" },
          { header: "Paid Amount", width: 18, value: (i) => i.payments.reduce((s, p) => s + Number(p.amount), 0), numFmt: "₹#,##0" },
          { header: "Balance", width: 18, value: (i) => Number(i.totalAmount) - i.payments.reduce((s, p) => s + Number(p.amount), 0), numFmt: "₹#,##0" },
        ] as ExportColumn<InvoiceRow>[])
      : []),
  ];

  const buffer = await buildExcelWorkbook({
    sheetName: "Invoices",
    title: "Invoices Export",
    subtitle: `Exported by ${session.user.name} on ${new Date().toLocaleString("en-IN")} · ${invoices.length} record(s)`,
    columns,
    rows: invoices,
  });

  const filename = `living360-invoices-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as any, { headers: excelResponseHeaders(filename) });
}
