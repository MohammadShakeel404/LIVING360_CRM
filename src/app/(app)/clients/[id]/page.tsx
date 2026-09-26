import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Phone, Mail, MapPin, FileText, Receipt, Building2, MessageCircle, Plus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { quotationTotals } from "@/lib/totals";
import { effectiveInvoiceStatus } from "@/lib/invoices";
import { Avatar, Card, MiniStat, PageHeader, StatusChip, formatCurrency, formatDate } from "@/components/ui";
import { ClientEditButton } from "./ClientEditButton";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "clients", "view")) redirect("/dashboard");

  const c = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      lead: { select: { id: true, leadNumber: true, propertyType: true, projectLocation: true, whatsapp: true } },
      projects: { include: { projectManager: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      quotations: { include: { items: { select: { quantity: true, rate: true, discountPct: true, gstPct: true } } }, orderBy: { createdAt: "desc" } },
      invoices: { include: { payments: { select: { amount: true } } }, orderBy: { invoiceDate: "desc" } },
    },
  });
  if (!c) notFound();

  const financial = can(role, "clients", "financial");
  const invoices = c.invoices.map((i) => {
    const total = Number(i.totalAmount);
    const paid = i.payments.reduce((s, p) => s + Number(p.amount), 0);
    return { ...i, total, paid, status: effectiveInvoiceStatus(i.status, total, paid, i.dueDate) };
  });
  const live = invoices.filter((i) => i.status !== "CANCELLED" && i.status !== "DRAFT");
  const billed = live.reduce((s, i) => s + i.total, 0);
  const received = live.reduce((s, i) => s + i.paid, 0);
  const wa = (c.lead?.whatsapp ?? c.phone).replace(/\D/g, "");

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5">
      <PageHeader
        back="/clients"
        title={c.name}
        subtitle={`${c.clientNumber} · client since ${formatDate(c.convertedAt)}`}
        actions={
          can(role, "clients", "edit") ? (
            <ClientEditButton client={{ id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, gstin: c.gstin }} />
          ) : undefined
        }
      />

      <div className="grid gap-5 md:grid-cols-[320px_1fr]">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={c.name} size={48} tone="bg-dark" />
            <div>
              <div className="text-[16px] font-bold text-ink">{c.name}</div>
              <div className="text-[12.5px] text-ink-soft">{c.lead?.propertyType ?? "—"}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-[13px] text-ink-soft">
            <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-primary"><Phone size={14} /> {c.phone}</a>
            <a href={`https://wa.me/${wa.length === 10 ? "91" + wa : wa}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary"><MessageCircle size={14} /> WhatsApp</a>
            {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-primary"><Mail size={14} /> {c.email}</a>}
            {(c.address ?? c.lead?.projectLocation) && <div className="flex items-start gap-2"><MapPin size={14} className="mt-0.5" /> {c.address ?? c.lead?.projectLocation}</div>}
            {c.gstin && <div className="font-medium text-ink">GSTIN {c.gstin}</div>}
            {c.lead && <Link href={`/leads/${c.lead.id}`} className="mt-1 text-[12.5px] font-semibold text-primary">View original lead {c.lead.leadNumber} →</Link>}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          {financial && (
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Billed" value={formatCurrency(billed)} />
              <MiniStat label="Received" value={formatCurrency(received)} tone="text-success" />
              <MiniStat label="Outstanding" value={formatCurrency(Math.max(billed - received, 0))} tone={billed - received > 0.5 ? "text-warning" : "text-ink"} />
            </div>
          )}

          <Card
            title="Projects"
            action={can(role, "projects", "create") ? <Link href={`/projects?new=1&clientId=${c.id}`} className="flex items-center gap-1 text-[13px] font-semibold text-primary"><Plus size={14} /> New</Link> : undefined}
          >
            {c.projects.length === 0 ? <Empty icon={Building2} text="No project started yet." /> : (
              <div className="-m-4">
                {c.projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                    <div>
                      <div className="text-[13.5px] font-semibold text-primary">{p.projectNumber}</div>
                      <div className="text-[12px] text-ink-faint">{p.projectManager?.name ?? "No PM assigned"} · {p.siteLocation ?? "—"}</div>
                    </div>
                    <StatusChip status={p.stage} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Quotations"
            action={can(role, "quotations", "create") ? <Link href={`/quotations/new?clientId=${c.id}`} className="flex items-center gap-1 text-[13px] font-semibold text-primary"><Plus size={14} /> New</Link> : undefined}
          >
            {c.quotations.length === 0 ? <Empty icon={FileText} text="No quotations yet." /> : (
              <div className="-m-4">
                {c.quotations.map((q) => (
                  <Link key={q.id} href={`/quotations/${q.id}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                    <div>
                      <div className="text-[13.5px] font-semibold text-primary">{q.quotationNumber}</div>
                      <div className="text-[12px] text-ink-faint">{formatDate(q.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {financial && <span className="text-[13px] font-semibold">{formatCurrency(quotationTotals(q.items, q.discountPct).grandTotal)}</span>}
                      <StatusChip status={q.status} label={q.status === "APPROVED" ? "Accepted" : undefined} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {can(role, "invoices", "view") && (
            <Card
              title="Invoices"
              action={can(role, "invoices", "create") && financial ? <Link href={`/invoices/new?clientId=${c.id}`} className="flex items-center gap-1 text-[13px] font-semibold text-primary"><Plus size={14} /> New</Link> : undefined}
            >
              {invoices.length === 0 ? <Empty icon={Receipt} text="No invoices yet." /> : (
                <div className="-m-4">
                  {invoices.map((i) => (
                    <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                      <div>
                        <div className="text-[13.5px] font-semibold text-primary">{i.invoiceNumber}</div>
                        <div className="text-[12px] text-ink-faint">{formatDate(i.invoiceDate)}</div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {financial && <span className="text-[13px] font-semibold">{formatCurrency(i.total)}</span>}
                        <StatusChip status={i.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: any; text: string }) {
  return <div className="flex flex-col items-center gap-2 py-4 text-center text-[13px] text-ink-soft"><Icon size={20} className="text-ink-faint" /> {text}</div>;
}
