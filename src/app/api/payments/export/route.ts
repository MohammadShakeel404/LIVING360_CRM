import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildExcelWorkbook, excelResponseHeaders, ExportColumn } from "@/lib/excel";
import { buildPaymentWhere } from "@/lib/paymentWhere";

async function fetchPayments(where: NonNullable<Parameters<typeof prisma.payment.findMany>[0]>["where"]) {
  return prisma.payment.findMany({
    where,
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          client: { select: { name: true } }
        }
      }
    },
    orderBy: { paidAt: "desc" },
  });
}
type PaymentRow = Awaited<ReturnType<typeof fetchPayments>>[number];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "payments", "export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = buildPaymentWhere(req.nextUrl.searchParams);
  const payments = await fetchPayments(where);
  const financial = can(session.user.role, "payments", "financial");

  const columns: ExportColumn<PaymentRow>[] = [
    { header: "Payment ID", width: 14, value: (p) => p.id.slice(-8) },
    { header: "Invoice #", width: 18, value: (p) => p.invoice.invoiceNumber },
    { header: "Client", width: 24, value: (p) => p.invoice.client.name },
    { header: "Method", width: 16, value: (p) => p.method.replaceAll("_", " ") },
    { header: "Reference", width: 20, value: (p) => p.referenceNumber ?? "—" },
    { header: "Paid At", width: 16, value: (p) => p.paidAt, numFmt: "dd-mmm-yyyy" },
    ...(financial
      ? ([
          { header: "Amount", width: 18, value: (p) => Number(p.amount), numFmt: "₹#,##0" },
        ] as ExportColumn<PaymentRow>[])
      : []),
  ];

  const buffer = await buildExcelWorkbook({
    sheetName: "Payments",
    title: "Payments Export",
    subtitle: `Exported by ${session.user.name} on ${new Date().toLocaleString("en-IN")} · ${payments.length} record(s)`,
    columns,
    rows: payments,
  });

  const filename = `living360-payments-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as any, { headers: excelResponseHeaders(filename) });
}
