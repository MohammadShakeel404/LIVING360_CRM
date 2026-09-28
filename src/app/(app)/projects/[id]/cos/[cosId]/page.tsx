import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, canManageContracts } from "@/lib/permissions";
import { changeOrderTotals } from "@/lib/contracts";
import { sharePath } from "@/lib/settings";
import { Card, MiniStat, PageHeader, StatusChip, formatCurrency, formatDate } from "@/components/ui";
import { DocumentActions } from "@/components/DocumentActions";
import { CosActions } from "./CosActions";

export default async function CosDetailPage({ params }: { params: { id: string; cosId: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "projects", "view")) redirect("/dashboard");

  const c = await prisma.changeOrder.findUnique({
    where: { id: params.cosId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      project: { include: { client: { include: { lead: { select: { whatsapp: true } } } } } },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { name: true } },
      invoices: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true } },
    },
  });
  if (!c || c.projectId !== params.id) notFound();

  const financial = can(role, "projects", "financial");
  const t = changeOrderTotals(c.items);
  const client = c.project.client;
  const invoiced = c.invoices.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s + Number(i.totalAmount), 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={`/projects/${c.projectId}`}
        title={c.cosNumber}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusChip status={c.status} /> {c.title}</span>}
      />

      {financial && (
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Additions" value={formatCurrency(t.addTaxable)} tone="text-success" sub="excl. GST" />
          <MiniStat label="Deductions" value={formatCurrency(t.dedTaxable)} tone="text-danger" sub="excl. GST" />
          <MiniStat label={t.net < 0 ? "Net credit" : "Net change"} value={`${t.net < 0 ? "− " : "+ "}${formatCurrency(Math.abs(t.net))}`} sub="incl. GST" tone={t.net < 0 ? "text-danger" : "text-primary"} />
        </div>
      )}

      {financial && (
        <Card>
          <div className="flex flex-col gap-4">
            <DocumentActions
              pdfUrl={`/api/changeorders/${c.id}/pdf`}
              sharePath={sharePath("cos", c.id)}
              filename={`${c.cosNumber}.pdf`}
              title={`Change of scope ${c.cosNumber}`}
              recipientName={client.name}
              phone={client.lead?.whatsapp ?? client.phone}
              email={client.email}
            />
            {canManageContracts(role) && (
              <CosActions
                id={c.id}
                projectId={c.projectId}
                status={c.status}
                hasInvoices={c.invoices.length > 0}
                canInvoice={can(role, "invoices", "create") && can(role, "invoices", "financial") && t.net - invoiced > 1}
                clientId={client.id}
              />
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Project</div>
          <Link href={`/projects/${c.projectId}`} className="text-[15px] font-semibold text-primary hover:underline">{c.project.projectNumber}</Link>
          <div className="text-[12.5px] text-ink-soft">{client.name}</div>
        </Card>
        <Card>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Timeline impact</div>
          <div className="text-[15px] font-semibold text-ink">{c.timeImpactDays ? `${c.timeImpactDays > 0 ? "+" : ""}${c.timeImpactDays} days` : "None"}</div>
          {c.quotation && <Link href={`/quotations/${c.quotation.id}`} className="text-[12.5px] text-primary">Against {c.quotation.quotationNumber}</Link>}
        </Card>
        <Card>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Raised by</div>
          <div className="text-[15px] font-semibold text-ink">{c.createdBy.name}</div>
          <div className="text-[12.5px] text-ink-soft">{formatDate(c.createdAt)}{c.approvedAt ? ` · approved ${formatDate(c.approvedAt)}` : ""}</div>
        </Card>
      </div>

      {c.reason && <Card title="Reason"><div className="whitespace-pre-wrap text-[13.5px] text-ink-soft">{c.reason}</div></Card>}

      {financial && (
        <Card title="Lines">
          <div className="-m-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-appbg text-left text-[11.5px] font-semibold text-ink-soft">
                  <th className="px-4 py-2.5">Item</th><th className="px-3 py-2.5 text-right">Qty</th><th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">GST</th><th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {c.items.map((i) => (
                  <tr key={i.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-2.5">
                      <span className={`mr-2 rounded px-1.5 py-0.5 text-[10.5px] font-bold ${i.deduction ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>{i.deduction ? "DEDUCT" : "ADD"}</span>
                      <span className="font-medium text-ink">{i.name}</span>
                      <div className="text-[12px] text-ink-faint">{[i.category, i.description].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{i.quantity.toString()} {i.unit}</td>
                    <td className="px-3 py-2.5 text-right">{formatCurrency(i.rate.toString())}</td>
                    <td className="px-3 py-2.5 text-right text-ink-soft">{Number(i.gstPct)}%</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${i.deduction ? "text-danger" : "text-ink"}`}>{i.deduction ? "− " : ""}{formatCurrency(Number(i.quantity) * Number(i.rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {c.invoices.length > 0 && (
        <Card title="Invoices">
          <div className="-m-4">
            {c.invoices.map((i) => (
              <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                <span className="font-semibold text-primary">{i.invoiceNumber}</span>
                <span className="flex items-center gap-2.5"><span className="text-[13px] font-semibold">{formatCurrency(i.totalAmount.toString())}</span><StatusChip status={i.status} /></span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
