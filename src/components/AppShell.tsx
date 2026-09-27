"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Flame, Users, ListChecks, MoreHorizontal, Plus, Search, Bell,
  ChevronDown, FileText, Receipt, Wallet, Building2, MapPin, FolderOpen,
  UserCog, BarChart3, Settings, Clock, PanelLeftClose, PanelLeft, LogOut, X, HardHat,
} from "lucide-react";
import { Avatar } from "@/components/ui";
import { Toaster } from "@/components/toast";
import { ConfirmHost } from "@/components/confirm";

const SIDEBAR_GROUPS = [
  { items: [{ href: "/dashboard", label: "Home", icon: Home, module: "dashboard" }] },
  {
    title: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: Flame, module: "leads" },
      { href: "/followups", label: "Follow-ups", icon: Clock, module: "followups" },
      { href: "/clients", label: "Clients", icon: Users, module: "clients" },
      { href: "/sitevisits", label: "Site Visits", icon: MapPin, module: "sitevisits" },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/quotations", label: "Quotations", icon: FileText, module: "quotations" },
      { href: "/invoices", label: "Invoices", icon: Receipt, module: "invoices" },
      { href: "/payments", label: "Payments", icon: Wallet, module: "payments" },
    ],
  },
  {
    title: "Delivery",
    items: [
      { href: "/projects", label: "Projects", icon: Building2, module: "projects" },
      { href: "/workers", label: "Workers", icon: HardHat, module: "workers" },
      { href: "/tasks", label: "Tasks", icon: ListChecks, module: "tasks" },
      { href: "/documents", label: "Documents", icon: FolderOpen, module: "documents" },
    ],
  },
  {
    title: "Organization",
    items: [
      { href: "/employees", label: "Employees", icon: UserCog, module: "employees" },
      { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
      { href: "/settings", label: "Settings", icon: Settings, module: "settings" },
    ],
  },
];

const HOME_TAB = { href: "/dashboard", label: "Home", icon: Home, module: "dashboard" };
const MORE_TAB = { href: "/more", label: "More", icon: MoreHorizontal, module: "dashboard" };
// Middle tabs are picked per role from this list, in priority order.
const MIDDLE_TABS = [
  { href: "/leads", label: "Leads", icon: Flame, module: "leads" },
  { href: "/quotations", label: "Quotes", icon: FileText, module: "quotations" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, module: "tasks" },
  { href: "/projects", label: "Projects", icon: Building2, module: "projects" },
  { href: "/invoices", label: "Invoices", icon: Receipt, module: "invoices" },
  { href: "/clients", label: "Clients", icon: Users, module: "clients" },
];

export type ShellAlert = { href: string; text: string; tone: "warning" | "danger" | "primary" };

export function AppShell({
  children, userName, roleLabel, visibleModules, canCreateLead, alerts,
}: {
  children: React.ReactNode;
  userName: string;
  roleLabel: string;
  visibleModules: string[];
  canCreateLead: boolean;
  alerts: ShellAlert[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<"notif" | "user" | null>(null);
  const [mobileSearch, setMobileSearch] = useState(false);

  const visible = new Set(visibleModules);
  const groups = SIDEBAR_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible.has(i.module)) })).filter((g) => g.items.length);
  // With the centre + button we need 2 tabs on each side; otherwise 5 tabs.
  const middle = MIDDLE_TABS.filter((t) => visible.has(t.module)).slice(0, canCreateLead ? 2 : 3);
  const tabs = [HOME_TAB, ...middle, MORE_TAB];

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest?.("[data-menu]")) setMenu(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => { setMenu(null); setMobileSearch(false); }, [pathname]);

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const alertDot = alerts.length > 0 && <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-danger ring-2 ring-white" />;
  const alertList = (
    <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-xl2 border border-line bg-white shadow-xl">
      <div className="border-b border-line-soft px-4 py-3 text-[13.5px] font-semibold">Needs your attention</div>
      {alerts.length === 0 && <div className="px-4 py-4 text-[12.5px] text-ink-soft">You&apos;re all caught up.</div>}
      {alerts.map((a) => (
        <Link key={a.href + a.text} href={a.href} className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3 text-[13px] text-ink last:border-0 hover:bg-appbg">
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${a.tone === "danger" ? "bg-danger" : a.tone === "warning" ? "bg-warning" : "bg-primary"}`} />
          {a.text}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-appbg">
      {/* SIDEBAR — desktop/tablet */}
      <aside
        className="hidden md:flex flex-shrink-0 flex-col bg-dark transition-[width] duration-150"
        style={{ width: collapsed ? 76 : 232 }}
      >
        <Link href="/dashboard" className={`flex items-center gap-2.5 px-4 py-5 ${collapsed ? "justify-center px-0" : ""}`}>
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-gold text-[15px] font-extrabold text-dark">
            L
          </div>
          {!collapsed && <span className="text-[15.5px] font-bold tracking-wide text-white">Living 360</span>}
        </Link>

        <nav className="flex-1 overflow-y-auto px-3">
          {groups.map((g, gi) => (
            <div key={gi} className="mb-3.5">
              {g.title && !collapsed && (
                <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#7B71A8]">{g.title}</div>
              )}
              {g.items.map((n) => {
                const active = pathname?.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    title={n.label}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] transition-colors ${collapsed ? "justify-center" : ""} ${active ? "bg-gold/15" : "hover:bg-white/5"}`}
                  >
                    <n.icon size={17} className={active ? "text-gold" : "text-[#B3A8DC]"} />
                    {!collapsed && (
                      <span className={`text-[13.5px] font-medium ${active ? "text-white" : "text-[#C9BFE8]"}`}>{n.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => setCollapsed((s) => !s)}
            className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] hover:bg-white/5 ${collapsed ? "justify-center" : ""}`}
          >
            {collapsed ? (
              <PanelLeft size={17} className="text-[#B3A8DC]" />
            ) : (
              <>
                <PanelLeftClose size={17} className="text-[#B3A8DC]" />
                <span className="text-[13px] font-medium text-[#C9BFE8]">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP BAR — desktop/tablet */}
        <header className="hidden md:flex flex-shrink-0 items-center justify-between gap-4 border-b border-line bg-white px-6 py-3" data-menu>
          <form onSubmit={onSearch} className="flex w-full max-w-[380px] items-center gap-2.5 rounded-[10px] bg-appbg px-3 py-2 ring-primary/30 focus-within:ring-2">
            <Search size={16} className="text-ink-faint" />
            <input name="q" placeholder="Search leads, clients, quotations, invoices…" className="flex-1 bg-transparent text-[13.5px] outline-none" />
          </form>
          <div className="flex items-center gap-3">
            {canCreateLead && (
              <Link href="/leads?new=1" className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-[9px] text-[13px] font-semibold text-white hover:bg-primary-deep">
                <Plus size={15} /> New lead
              </Link>
            )}
            <div className="relative">
              <button aria-label="Notifications" onClick={() => setMenu((m) => (m === "notif" ? null : "notif"))} className="relative rounded-[10px] bg-appbg p-2 hover:bg-line-soft">
                <Bell size={17} className="text-ink-soft" />
                {alertDot}
              </button>
              {menu === "notif" && alertList}
            </div>
            <div className="h-6 w-px bg-line" />
            <div className="relative">
              <button onClick={() => setMenu((m) => (m === "user" ? null : "user"))} className="flex items-center gap-2 rounded-[10px] py-1 pl-1 pr-2 hover:bg-appbg">
                <Avatar name={userName} size={32} />
                <div className="hidden text-left lg:block">
                  <div className="text-[13px] font-semibold leading-tight text-ink">{userName}</div>
                  <div className="text-[11.5px] leading-tight text-ink-soft">{roleLabel}</div>
                </div>
                <ChevronDown size={14} className="text-ink-faint" />
              </button>
              {menu === "user" && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl2 border border-line bg-white shadow-xl">
                  <div className="border-b border-line-soft px-4 py-3">
                    <div className="text-[13.5px] font-semibold text-ink">{userName}</div>
                    <div className="text-[12px] text-ink-soft">{roleLabel}</div>
                  </div>
                  {visible.has("settings") && (
                    <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink hover:bg-appbg"><Settings size={15} className="text-ink-soft" /> Settings</Link>
                  )}
                  <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-danger hover:bg-danger-bg">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* TOP BAR — mobile */}
        <header className="flex md:hidden flex-shrink-0 items-center justify-between border-b border-line bg-white px-4 py-3">
          {mobileSearch ? (
            <form onSubmit={onSearch} className="flex flex-1 items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-[10px] bg-appbg px-3 py-2">
                <Search size={16} className="text-ink-faint" />
                <input name="q" autoFocus placeholder="Search…" className="flex-1 bg-transparent text-[14px] outline-none" />
              </div>
              <button type="button" aria-label="Close search" onClick={() => setMobileSearch(false)} className="p-2"><X size={19} className="text-ink-soft" /></button>
            </form>
          ) : (
            <>
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold text-[13px] font-extrabold text-dark">L</div>
                <span className="text-[15px] font-bold text-ink">Living 360</span>
              </Link>
              <div className="relative flex items-center gap-1" data-menu>
                <button aria-label="Search" onClick={() => setMobileSearch(true)} className="p-2"><Search size={19} className="text-ink-soft" /></button>
                <button aria-label="Notifications" onClick={() => setMenu((m) => (m === "notif" ? null : "notif"))} className="relative p-2">
                  <Bell size={19} className="text-ink-soft" />
                  {alertDot}
                </button>
                {menu === "notif" && alertList}
              </div>
            </>
          )}
        </header>

        {/* CONTENT */}
        {/* Sticky footers inside pages offset by this bottom padding (see the editors). */}
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 md:px-6 md:pb-10 md:pt-6">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </div>

      {/* BOTTOM NAV — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        {canCreateLead && (
          <Link
            href="/leads?new=1"
            aria-label="New lead"
            className="absolute left-1/2 top-[-20px] flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-appbg bg-primary shadow-[0_8px_18px_rgba(82,58,183,0.42)]"
          >
            <Plus size={23} className="text-white" strokeWidth={2.5} />
          </Link>
        )}
        <div className="flex items-stretch border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
          {tabs.map((n, i) => {
            const active = pathname?.startsWith(n.href);
            return (
              <Fragment key={n.href}>
                {canCreateLead && i === 2 && <div className="flex-1" aria-hidden />}
                <Link href={n.href} className="flex flex-1 flex-col items-center gap-[3px] py-[9px]">
                  <n.icon size={20} className={active ? "text-primary" : "text-ink-faint"} strokeWidth={active ? 2.4 : 2} />
                  <span className={`text-[10.5px] ${active ? "font-bold text-primary" : "font-medium text-ink-faint"}`}>{n.label}</span>
                </Link>
              </Fragment>
            );
          })}
        </div>
      </nav>

      <Toaster />
      <ConfirmHost />
    </div>
  );
}
