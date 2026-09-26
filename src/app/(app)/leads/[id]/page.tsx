import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Phone, MessageCircle, Mail, MapPin, Building2, IndianRupee, ArrowUpRight, Calendar, FileText, UserCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { quotationTotals } from "@/lib/totals";
import { LEAD_STAGE_LABEL, humanize } from "@/lib/labels";
import { ScoreChip, Avatar, Card, StatusChip, PageHeader, formatCurrency, formatDate, formatDateTime } from "@/components/ui";
import { LeadActions } from "./LeadActions";
import { FollowUpList } from "@/components/FollowUpList";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const { role, id: userId } = session!.user;
  if (!can(role, "leads", "view")) redirect("/leads");

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      followUps: { orderBy: { scheduledAt: "desc" }, take: 30, include: { createdBy: { select: { name: true } } } },
      quotations: { orderBy: { createdAt: "desc" }, include: { items: { select: { quantity: true, rate: true, discountPct: true, gstPct: true } } } },
      client: { select: { id: true, clientNumber: true } },
    },
  });
  if (!lead || (role === "SALES_EXECUTIVE" && lead.assignedToId !== userId)) notFound();

  const financial = can(role, "leads", "financial");
  const canEdit = can(role, "leads", "edit");
  const overdue = lead.nextFollowUpAt ? lead.nextFollowUpAt < new Date() : false;
  const team = canEdit && role !== "SALES_EXECUTIVE"
    ? await prisma.user.findMany({ where: { status: "ACTIVE", role: { in: ["SALES_EXECUTIVE", "SALES_MANAGER", "ADMIN", "SUPER_ADMIN"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const wa = (lead.whatsapp ?? lead.phone).replace(/\D/g, "");

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-5">
      <PageHeader
        back="/leads"
        title={lead.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{lead.leadNumber} · <StatusChip status={lead.stage} label={LEAD_STAGE_LABEL[lead.stage]} /> <ScoreChip score={lead.score} /></span>}
      />

      <div className="grid grid-cols-3 gap-2 md:max-w-md">
        <a href={`tel:${lead.phone}`} className="flex items-center justify-center gap-2 rounded-xl2 bg-success-bg py-2.5 text-[13px] font-semibold text-success"><Phone size={16} /> Call</a>
        <a href={`https://wa.me/${wa.length === 10 ? "91" + wa : wa}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl2 bg-[#25D366]/15 py-2.5 text-[13px] font-semibold text-[#128C4B]"><MessageCircle size={16} /> WhatsApp</a>
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className="flex items-center justify-center gap-2 rounded-xl2 bg-primary/10 py-2.5 text-[13px] font-semibold text-primary"><Mail size={16} /> Email</a>
        ) : (
          <span className="flex items-center justify-center gap-2 rounded-xl2 bg-line-soft py-2.5 text-[13px] font-semibold text-ink-faint"><Mail size={16} /> No email</span>
        )}
      </div>

      {overdue && (
        <div className="rounded-xl2 border border-danger/20 bg-danger-bg p-3 text-[13px] font-medium text-danger">
          Follow-up overdue since {formatDateTime(lead.nextFollowUpAt)}. This lead needs attention.
        </div>
      )}
      {lead.stage === "LOST" && lead.lostReason && (
        <div className="rounded-xl2 bg-line-soft p-3 text-[13px] text-ink-soft"><b className="text-ink">Lost:</b> {lead.lostReason}</div>
      )}
      {lead.client && (
        <Link href={`/clients/${lead.client.id}`} className="flex items-center gap-2 rounded-xl2 border border-success/30 bg-success-bg p-3 text-[13px] font-semibold text-success">
          <UserCheck size={16} /> Converted to client {lead.client.clientNumber} — open client
        </Link>
      )}

      {canEdit && (
        <LeadActions
          lead={{
            id: lead.id, name: lead.name, phone: lead.phone, whatsapp: lead.whatsapp, email: lead.email, stage: lead.stage, score: lead.score,
            source: lead.source, propertyType: lead.propertyType, propertySize: lead.propertySize, bedrooms: lead.bedrooms,
            projectLocation: lead.projectLocation, address: lead.address,
            budgetMin: financial ? lead.budgetMin?.toString() ?? null : null, budgetMax: financial ? lead.budgetMax?.toString() ?? null : null,
            assignedToId: lead.assignedToId, isClient: !!lead.client,
          }}
          financial={financial}
          team={team}
          canFollowUp={can(role, "followups", "create")}
          canQuote={can(role, "quotations", "create")}
          canDelete={can(role, "leads", "delete")}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Details">
          <div className="flex flex-col gap-3">
            <InfoRow icon={Phone} label="Mobile" value={lead.phone} />
            {lead.whatsapp && lead.whatsapp !== lead.phone && <InfoRow icon={MessageCircle} label="WhatsApp" value={lead.whatsapp} />}
            <InfoRow icon={MapPin} label="Location" value={lead.projectLocation ?? lead.location ?? "—"} />
            <InfoRow icon={Building2} label="Property" value={[lead.propertyType, lead.propertySize].filter(Boolean).join(" · ") || "—"} />
            <InfoRow icon={IndianRupee} label="Budget" value={financial ? (lead.budgetMin || lead.budgetMax ? `${formatCurrency(lead.budgetMin?.toString())} – ${formatCurrency(lead.budgetMax?.toString())}` : "—") : "Restricted"} />
            <InfoRow icon={ArrowUpRight} label="Source" value={humanize(lead.source)} />
            <InfoRow icon={Calendar} label="Next follow-up" value={lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : "Not scheduled"} valueCls={overdue ? "text-danger" : "text-ink"} />
            <div className="flex items-center gap-2.5 border-t border-line-soft pt-3">
              {lead.assignedTo ? <Avatar name={lead.assignedTo.name} size={30} /> : null}
              <div>
                <div className="text-[13px] font-semibold text-ink">{lead.assignedTo?.name ?? "Unassigned"}</div>
                <div className="text-[11.5px] text-ink-soft">Assigned executive · created {formatDate(lead.createdAt)}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Quotations" action={can(role, "quotations", "create") && lead.stage !== "LOST" ? <Link href={`/quotations/new?leadId=${lead.id}`} className="text-[13px] font-semibold text-primary">+ New</Link> : undefined}>
          {lead.quotations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-[13px] text-ink-soft">
              <FileText size={22} className="text-ink-faint" /> No quotations yet.
            </div>
          ) : (
            <div className="-m-4">
              {lead.quotations.map((q) => (
                <Link key={q.id} href={`/quotations/${q.id}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-appbg">
                  <div>
                    <div className="text-[13.5px] font-semibold text-primary">{q.quotationNumber}</div>
                    <div className="text-[12px] text-ink-faint">{formatDate(q.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {can(role, "quotations", "financial") && <span className="text-[13px] font-semibold">{formatCurrency(quotationTotals(q.items, q.discountPct).grandTotal)}</span>}
                    <StatusChip status={q.status} label={q.status === "APPROVED" ? "Accepted" : undefined} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div>
        <div className="mb-2.5 text-[15px] font-semibold text-ink">Follow-up history</div>
        <FollowUpList
          canEdit={can(role, "followups", "edit")}
          items={lead.followUps.map((f) => ({
            id: f.id, type: f.type, status: f.status, scheduledAt: f.scheduledAt.toISOString(),
            notes: f.notes, outcome: f.outcome, by: f.createdBy.name,
          }))}
        />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, valueCls = "text-ink" }: { icon: any; label: string; value: string; valueCls?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 text-ink-soft"><Icon size={15} /><span className="text-[13.5px]">{label}</span></div>
      <span className={`text-right text-[13.5px] font-semibold ${valueCls}`}>{value}</span>
    </div>
  );
}
