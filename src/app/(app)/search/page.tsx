import Link from "next/link";
import { getServerSession } from "next-auth";
import { Flame, Users, FileText, Receipt, Search } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState, PageHeader, StatusChip } from "@/components/ui";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getServerSession(authOptions);
  const { role, id } = session!.user;
  const q = searchParams.q?.trim() ?? "";
  if (!q) return <EmptyState icon={Search} title="Search" note="Type a name, phone number or document number in the search bar." />;

  const ci = { contains: q, mode: "insensitive" as const };
  const own = role === "SALES_EXECUTIVE";
  const [leads, clients, quotations, invoices] = await Promise.all([
    can(role, "leads", "view")
      ? prisma.lead.findMany({ where: { OR: [{ name: ci }, { phone: { contains: q } }, { leadNumber: ci }], ...(own ? { assignedToId: id } : {}) }, take: 10 })
      : [],
    can(role, "clients", "view")
      ? prisma.client.findMany({ where: { OR: [{ name: ci }, { phone: { contains: q } }, { clientNumber: ci }] }, take: 10 })
      : [],
    can(role, "quotations", "view")
      ? prisma.quotation.findMany({
          where: { OR: [{ quotationNumber: ci }, { client: { name: ci } }, { lead: { name: ci } }], ...(own ? { salespersonId: id } : {}) },
          include: { client: { select: { name: true } }, lead: { select: { name: true } } },
          take: 10,
        })
      : [],
    can(role, "invoices", "view")
      ? prisma.invoice.findMany({ where: { OR: [{ invoiceNumber: ci }, { client: { name: ci } }] }, include: { client: { select: { name: true } } }, take: 10 })
      : [],
  ]);

  const groups = [
    { title: "Leads", icon: Flame, rows: leads.map((l) => ({ href: `/leads/${l.id}`, title: l.name, sub: `${l.leadNumber} · ${l.phone}`, status: l.stage })) },
    { title: "Clients", icon: Users, rows: clients.map((c) => ({ href: `/clients/${c.id}`, title: c.name, sub: `${c.clientNumber} · ${c.phone}`, status: null })) },
    { title: "Quotations", icon: FileText, rows: quotations.map((x) => ({ href: `/quotations/${x.id}`, title: x.quotationNumber, sub: x.client?.name ?? x.lead?.name ?? "—", status: x.status })) },
    { title: "Invoices", icon: Receipt, rows: invoices.map((x) => ({ href: `/invoices/${x.id}`, title: x.invoiceNumber, sub: x.client.name, status: x.status })) },
  ].filter((g) => g.rows.length);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={`Results for “${q}”`} subtitle={`${groups.reduce((n, g) => n + g.rows.length, 0)} matches`} />
      {groups.length === 0 && <EmptyState icon={Search} title="No matches" note="Try a different name, phone number or document number." />}
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink-soft"><g.icon size={15} /> {g.title}</div>
          <div className="overflow-hidden rounded-xl2 border border-line bg-white">
            {g.rows.map((r) => (
              <Link key={r.href} href={r.href} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink">{r.title}</div>
                  <div className="truncate text-[12.5px] text-ink-soft">{r.sub}</div>
                </div>
                {r.status && <StatusChip status={r.status} />}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
