import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Flame, Sun, Snowflake, ChevronLeft } from "lucide-react";

export function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function Avatar({ name, size = 32, tone = "bg-primary" }: { name: string; size?: number; tone?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-full text-white font-semibold ${tone}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initialsOf(name)}
    </div>
  );
}

const SCORE_META = {
  HOT: { label: "Hot", cls: "text-danger bg-danger-bg", Icon: Flame },
  WARM: { label: "Warm", cls: "text-warning bg-warning-bg", Icon: Sun },
  COLD: { label: "Cold", cls: "text-[#4A7FC9] bg-[#EAF1FB]", Icon: Snowflake },
} as const;

export function ScoreChip({ score }: { score: keyof typeof SCORE_META }) {
  const m = SCORE_META[score];
  const Icon = m.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>
      <Icon size={12} strokeWidth={2.5} />
      {m.label}
    </span>
  );
}

const PRIORITY_CLS: Record<string, string> = {
  URGENT: "text-danger bg-danger-bg",
  HIGH: "text-warning bg-warning-bg",
  MEDIUM: "text-[#4A7FC9] bg-[#EAF1FB]",
  LOW: "text-ink-faint bg-line-soft",
};
export function PriorityChip({ priority }: { priority: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold flex-shrink-0 ${PRIORITY_CLS[priority] ?? PRIORITY_CLS.LOW}`}>
      {priority}
    </span>
  );
}

export function StatCard({
  label, value, sub, subTone = "text-ink", icon: Icon, href,
}: { label: string; value: string | number; sub?: string; subTone?: string; icon?: LucideIcon; href?: string }) {
  const Comp: any = href ? Link : "div";
  return (
    <Comp
      href={href}
      className="block min-w-0 rounded-xl2 border border-line bg-white p-4 text-left transition-all hover:border-primary/30 hover:shadow-[0_4px_16px_rgba(37,26,81,0.06)] active:scale-[0.98]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-ink-soft">{label}</span>
        {Icon && <Icon size={15} className="text-ink-soft" />}
      </div>
      <div className="text-2xl font-bold leading-none text-ink">{value}</div>
      {sub && <div className={`mt-1.5 text-xs font-medium ${subTone}`}>{sub}</div>}
    </Comp>
  );
}

export function SectionHeader({ title, actionHref, actionLabel }: { title: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {actionHref && (
        <Link href={actionHref} className="text-[13px] font-semibold text-primary">
          {actionLabel ?? "View all"}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-ink-soft">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-line-soft">
        <Icon size={24} className="text-primary" />
      </div>
      <div className="mb-1 text-[15px] font-semibold text-ink">{title}</div>
      <div className="max-w-[280px] text-[13.5px]">{note}</div>
    </div>
  );
}

export function formatCurrency(n?: number | string | null) {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
}

/* ---------- Status Chip (Quotation / Invoice / Project / Task) ---------- */

const STATUS_STYLES: Record<string, string> = {
  // Quotation / Invoice
  DRAFT: "text-ink-faint bg-line-soft",
  SENT: "text-[#4A7FC9] bg-[#EAF1FB]",
  VIEWED: "text-primary bg-[#EDE8F8]",
  APPROVED: "text-success bg-success-bg",
  REJECTED: "text-danger bg-danger-bg",
  EXPIRED: "text-ink-faint bg-line-soft",
  PARTIALLY_PAID: "text-warning bg-warning-bg",
  PAID: "text-success bg-success-bg",
  OVERDUE: "text-danger bg-danger-bg",
  CANCELLED: "text-ink-faint bg-line-soft",
  // Project stages
  PLANNING: "text-[#4A7FC9] bg-[#EAF1FB]",
  DESIGN: "text-primary bg-[#EDE8F8]",
  APPROVAL: "text-warning bg-warning-bg",
  PRODUCTION: "text-[#4A7FC9] bg-[#EAF1FB]",
  PROCUREMENT: "text-[#9C6B1F] bg-[#FFF6E0]",
  EXECUTION: "text-primary bg-[#EDE8F8]",
  INSTALLATION: "text-warning bg-warning-bg",
  HANDOVER: "text-success bg-success-bg",
  COMPLETED: "text-success bg-success-bg",
  // Tasks
  TODO: "text-ink-faint bg-line-soft",
  IN_PROGRESS: "text-[#4A7FC9] bg-[#EAF1FB]",
  WAITING: "text-warning bg-warning-bg",
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const display = label ?? status.replaceAll("_", " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold flex-shrink-0 ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
      {display}
    </span>
  );
}

/* ---------- Stage Timeline (Project stages) ---------- */

const PROJECT_STAGES = [
  "PLANNING", "DESIGN", "APPROVAL", "PRODUCTION", "PROCUREMENT",
  "EXECUTION", "INSTALLATION", "HANDOVER", "COMPLETED",
] as const;

const STAGE_LABELS: Record<string, string> = {
  PLANNING: "Planning", DESIGN: "Design", APPROVAL: "Approval",
  PRODUCTION: "Production", PROCUREMENT: "Procurement", EXECUTION: "Execution",
  INSTALLATION: "Installation", HANDOVER: "Handover", COMPLETED: "Completed",
};

export function StageTimeline({ currentStage }: { currentStage: string }) {
  const currentIdx = PROJECT_STAGES.indexOf(currentStage as typeof PROJECT_STAGES[number]);
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
      {PROJECT_STAGES.map((stage, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={stage} className="flex items-center gap-0.5 flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold
                  ${active ? "bg-primary text-white ring-2 ring-primary/30" : done ? "bg-success text-white" : "bg-line-soft text-ink-faint"}`}
              >
                {done && !active ? "✓" : i + 1}
              </div>
              <span className={`mt-1 text-[9px] font-medium whitespace-nowrap ${active ? "text-primary" : done ? "text-success" : "text-ink-faint"}`}>
                {STAGE_LABELS[stage]}
              </span>
            </div>
            {i < PROJECT_STAGES.length - 1 && (
              <div className={`h-0.5 w-4 flex-shrink-0 ${i < currentIdx ? "bg-success" : "bg-line"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Payment Method Chip ---------- */

const METHOD_STYLES: Record<string, string> = {
  CASH: "text-success bg-success-bg",
  UPI: "text-primary bg-[#EDE8F8]",
  BANK_TRANSFER: "text-[#4A7FC9] bg-[#EAF1FB]",
  CHEQUE: "text-warning bg-warning-bg",
  CARD: "text-[#9C6B1F] bg-[#FFF6E0]",
  OTHER: "text-ink-faint bg-line-soft",
};

export function MethodChip({ method }: { method: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold flex-shrink-0 ${METHOD_STYLES[method] ?? METHOD_STYLES.OTHER}`}>
      {method.replaceAll("_", " ")}
    </span>
  );
}

/* ---------- Date helpers ---------- */

export function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/* ---------- Form primitives ---------- */

export const inputCls =
  "w-full rounded-[10px] border-[1.5px] border-line bg-appbg px-3 py-2.5 text-[16px] outline-none transition-colors focus:border-primary focus:bg-white md:text-[14.5px]";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[12.5px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Card({ title, subtitle, action, children, className = "" }: { title?: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl2 border border-line bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div>
            {title && <div className="text-[14px] font-semibold text-ink">{title}</div>}
            {subtitle && <div className="text-[12px] text-ink-soft">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: React.ReactNode; back?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {back && (
          <Link href={back} aria-label="Back" className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink-soft hover:text-primary">
            <ChevronLeft size={17} />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink md:text-[22px]">{title}</h1>
          {subtitle && <div className="mt-0.5 text-[13px] text-ink-soft">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-[9px] text-[13px] font-semibold text-white transition-colors hover:bg-primary-deep disabled:opacity-50",
  secondary: "inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white px-3.5 py-[9px] text-[13px] font-semibold text-ink transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-line-soft px-3.5 py-[9px] text-[13px] font-semibold text-primary transition-colors hover:bg-[#E6E0F5] disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-danger/30 bg-white px-3.5 py-[9px] text-[13px] font-semibold text-danger transition-colors hover:bg-danger-bg disabled:opacity-50",
  success: "inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-success px-3.5 py-[9px] text-[13px] font-semibold text-white disabled:opacity-50",
};

export function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl2 border border-line bg-white p-3.5">
      <div className="text-[12px] font-medium text-ink-soft">{label}</div>
      <div className={`mt-1 truncate text-[19px] font-bold ${tone ?? "text-ink"}`}>{value}</div>
      {sub && <div className="text-[11.5px] text-ink-faint">{sub}</div>}
    </div>
  );
}
