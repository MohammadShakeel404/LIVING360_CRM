import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Phone, MessageCircle, Mail, MapPin, Building2, IndianRupee, ArrowUpRight, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { ScoreChip, Avatar, formatCurrency } from "@/components/ui";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "leads", "view")) redirect("/leads");

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { name: true } },
      followUps: { orderBy: { scheduledAt: "desc" }, take: 10 },
    },
  });
  if (!lead) notFound();

  const financial = can(role, "leads", "financial");
  const overdue = lead.nextFollowUpAt ? lead.nextFollowUpAt < new Date() : false;

  return (
    <div className="mx-auto max-w-[560px] flex flex-col gap-5">
      <Link href="/leads" className="flex items-center gap-1 text-[13.5px] font-medium text-ink-soft">
        <ChevronLeft size={16} /> Back to leads
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Avatar name={lead.name} size={48} tone="bg-dark" />
          <div>
            <div className="text-[18px] font-bold text-ink">{lead.name}</div>
            <div className="text-[13px] text-ink-soft">{lead.leadNumber} · {lead.stage.replaceAll("_", " ")}</div>
          </div>
        </div>
        <ScoreChip score={lead.score} />
      </div>

      <div className="flex gap-2">
        <a href={`tel:${lead.phone}`} className="flex flex-1 justify-center rounded-xl2 bg-success-bg py-2.5"><Phone size={17} className="text-success" /></a>
        <a href={`https://wa.me/${(lead.whatsapp ?? lead.phone).replace(/\D/g, "")}`} className="flex flex-1 justify-center rounded-xl2 bg-[#25D36629] py-2.5"><MessageCircle size={17} className="text-[#25D366]" /></a>
        {lead.email && <a href={`mailto:${lead.email}`} className="flex flex-1 justify-center rounded-xl2 bg-primary/10 py-2.5"><Mail size={17} className="text-primary" /></a>}
      </div>

      {overdue && (
        <div className="rounded-xl2 bg-danger-bg p-3 text-[13px] font-medium text-danger">
          Follow-up overdue since {lead.nextFollowUpAt?.toLocaleString("en-IN")}. This lead needs attention.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl2 border border-line bg-white p-4">
        <InfoRow icon={Phone} label="Mobile" value={lead.phone} />
        <InfoRow icon={MapPin} label="Location" value={lead.projectLocation ?? lead.location ?? "—"} />
        <InfoRow icon={Building2} label="Property" value={lead.propertyType ?? "—"} />
        <InfoRow icon={IndianRupee} label="Budget" value={financial ? `${formatCurrency(lead.budgetMin?.toString())} – ${formatCurrency(lead.budgetMax?.toString())}` : "Restricted"} />
        <InfoRow icon={ArrowUpRight} label="Source" value={lead.source.replaceAll("_", " ")} />
        <InfoRow icon={Calendar} label="Next follow-up" value={lead.nextFollowUpAt ? lead.nextFollowUpAt.toLocaleString("en-IN") : "Not scheduled"} valueCls={overdue ? "text-danger" : "text-ink"} />
        {lead.assignedTo && (
          <div className="flex items-center gap-2.5 border-t border-line-soft pt-3">
            <Avatar name={lead.assignedTo.name} size={30} />
            <div>
              <div className="text-[13px] font-semibold text-ink">{lead.assignedTo.name}</div>
              <div className="text-[11.5px] text-ink-soft">Assigned executive</div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2.5 text-[15px] font-semibold text-ink">Follow-up history</div>
        <div className="flex flex-col gap-2.5">
          {lead.followUps.length === 0 && <div className="text-[13px] text-ink-soft">No follow-ups logged yet.</div>}
          {lead.followUps.map((f) => (
            <div key={f.id} className="flex items-start gap-3 rounded-xl2 border border-line bg-white p-3">
              <div className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] ${f.status === "COMPLETED" ? "bg-success-bg" : "bg-line-soft"}`}>
                {f.status === "COMPLETED" ? <CheckCircle2 size={16} className="text-success" /> : <Clock size={16} className="text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-semibold text-ink">{f.type.replaceAll("_", " ")}</span>
                  <span className="text-xs font-medium text-ink-faint">{f.scheduledAt.toLocaleString("en-IN")}</span>
                </div>
                {f.notes && <div className="mt-0.5 text-[12.5px] text-ink-soft">{f.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, valueCls = "text-ink" }: { icon: any; label: string; value: string; valueCls?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 text-ink-soft"><Icon size={15} /><span className="text-[13.5px]">{label}</span></div>
      <span className={`text-[13.5px] font-semibold ${valueCls}`}>{value}</span>
    </div>
  );
}
