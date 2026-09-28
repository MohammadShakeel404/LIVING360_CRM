import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildExcelWorkbook, excelResponseHeaders } from "@/lib/excel";
import { assignmentSummary } from "@/lib/workers";

/** One row per worker per project: payable, paid, balance. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "workers", "export") || !can(role, "workers", "financial")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.projectWorker.findMany({
    include: {
      worker: { select: { workerNumber: true, name: true, trade: true, phone: true } },
      project: { select: { projectNumber: true, client: { select: { name: true } } } },
      payments: { select: { amount: true, stageId: true, paidAt: true } },
    },
    orderBy: [{ project: { projectNumber: "asc" } }, { createdAt: "asc" }],
  });
  type Row = (typeof rows)[number];
  const sum = (r: Row) => assignmentSummary(r);
  const buffer = await buildExcelWorkbook({
    sheetName: "Labour",
    title: "Workers & labour payments",
    subtitle: `Exported by ${session.user.name} on ${new Date().toLocaleString("en-IN")} · ${rows.length} work record(s)`,
    columns: [
      { header: "Project", width: 14, value: (r: Row) => r.project.projectNumber },
      { header: "Client", width: 22, value: (r: Row) => r.project.client.name },
      { header: "Worker ID", width: 11, value: (r: Row) => r.worker.workerNumber },
      { header: "Worker", width: 22, value: (r: Row) => r.worker.name },
      { header: "Trade", width: 18, value: (r: Row) => r.worker.trade },
      { header: "Phone", width: 15, value: (r: Row) => r.worker.phone },
      { header: "Work", width: 34, value: (r: Row) => r.scope },
      { header: "Status", width: 12, value: (r: Row) => r.status },
      { header: "Payable", width: 14, value: (r: Row) => sum(r).payable, numFmt: "#,##0.00" },
      { header: "Paid", width: 14, value: (r: Row) => sum(r).paid, numFmt: "#,##0.00" },
      { header: "Balance", width: 14, value: (r: Row) => sum(r).balance, numFmt: "#,##0.00" },
      { header: "Last paid", width: 14, value: (r: Row) => r.payments.map((p) => p.paidAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null, numFmt: "dd-mmm-yyyy" },
    ],
    rows,
  });
  return new NextResponse(buffer as any, { headers: excelResponseHeaders(`living360-labour-${new Date().toISOString().slice(0, 10)}.xlsx`) });
}
