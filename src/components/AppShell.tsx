"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Flame, Users, ListChecks, MoreHorizontal, Plus, Search, Bell,
  ChevronDown, FileText, Receipt, Wallet, Building2, MapPin, FolderOpen,
  UserCog, BarChart3, Settings, Clock, PanelLeftClose, PanelLeft, LogOut,
} from "lucide-react";
import { Avatar } from "@/components/ui";

const SIDEBAR_GROUPS = [
  { items: [{ href: "/dashboard", label: "Home", icon: Home }] },
  {
    title: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: Flame },
      { href: "/followups", label: "Follow-ups", icon: Clock },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/sitevisits", label: "Site Visits", icon: MapPin },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/quotations", label: "Quotations", icon: FileText },
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/payments", label: "Payments", icon: Wallet },
    ],
  },
  {
    title: "Delivery",
    items: [
      { href: "/projects", label: "Projects", icon: Building2 },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/documents", label: "Documents", icon: FolderOpen },
    ],
  },
  {
    title: "Organization",
    items: [
      { href: "/employees", label: "Employees", icon: UserCog },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const BOTTOM_TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/leads", label: "Leads", icon: Flame },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

export function AppShell({
  children, userName, userInitials,
}: { children: React.ReactNode; userName: string; userInitials: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-appbg">
      {/* SIDEBAR — desktop/tablet */}
      <div
        className="hidden md:flex flex-shrink-0 flex-col bg-dark transition-[width] duration-150"
        style={{ width: collapsed ? 76 : 232 }}
      >
        <div className={`flex items-center gap-2.5 px-4 py-5 ${collapsed ? "justify-center px-0" : ""}`}>
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-gold text-[15px] font-extrabold text-dark">
            L
          </div>
          {!collapsed && <span className="text-[15.5px] font-bold tracking-wide text-white">Living 360</span>}
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          {SIDEBAR_GROUPS.map((g, gi) => (
            <div key={gi} className="mb-3.5">
              {g.title && !collapsed && (
                <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-[#7B71A8]">{g.title}</div>
              )}
              {g.items.map((n) => {
                const active = pathname?.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    title={n.label}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] ${collapsed ? "justify-center" : ""} ${active ? "bg-gold/15" : ""}`}
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
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => setCollapsed((s) => !s)}
            className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] ${collapsed ? "justify-center" : ""}`}
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
      </div>

      {/* MAIN COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP BAR — desktop/tablet */}
        <div className="hidden md:flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-6 py-3.5">
          <div className="flex w-[340px] items-center gap-2.5 rounded-[10px] bg-appbg px-3 py-2">
            <Search size={16} className="text-ink-faint" />
            <input placeholder="Search leads, clients, quotations..." className="flex-1 bg-transparent text-[13.5px] outline-none" />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/leads?new=1" className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-[9px] text-[13px] font-semibold text-white">
              <Plus size={15} /> New lead
            </Link>
            <div className="relative">
              <button onClick={() => setNotifOpen((s) => !s)} className="relative rounded-[10px] bg-appbg p-2">
                <Bell size={17} className="text-ink-soft" />
                <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-danger" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl2 border border-line bg-white shadow-xl">
                  <div className="border-b border-line-soft px-4 py-3 text-[13.5px] font-semibold">Notifications</div>
                  <div className="px-4 py-3 text-[12.5px] text-ink-soft">You're all caught up.</div>
                </div>
              )}
            </div>
            <div className="h-6 w-px bg-line" />
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-2" title="Sign out">
              <Avatar name={userName} size={32} />
              <ChevronDown size={14} className="text-ink-faint" />
            </button>
          </div>
        </div>

        {/* TOP BAR — mobile */}
        <div className="flex md:hidden flex-shrink-0 items-center justify-between border-b border-line bg-white px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold text-[13px] font-extrabold text-dark">L</div>
            <span className="text-[15px] font-bold text-ink">Living 360</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2"><Search size={19} className="text-ink-soft" /></button>
            <button className="relative p-2">
              <Bell size={19} className="text-ink-soft" />
              <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-danger" />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 md:pb-8">
          <div className="mx-auto max-w-[1080px]">{children}</div>
        </div>
      </div>

      {/* BOTTOM NAV — mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <Link
          href="/leads?new=1"
          className="absolute left-1/2 top-[-20px] flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-appbg bg-primary shadow-[0_8px_18px_rgba(82,58,183,0.42)]"
        >
          <Plus size={23} className="text-white" strokeWidth={2.5} />
        </Link>
        <div className="flex items-stretch border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
          {BOTTOM_TABS.map((n) => {
            const active = pathname?.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className="flex flex-1 flex-col items-center gap-[3px] py-[9px]">
                <n.icon size={20} className={active ? "text-primary" : "text-ink-faint"} strokeWidth={active ? 2.4 : 2} />
                <span className={`text-[10.5px] ${active ? "font-bold text-primary" : "font-medium text-ink-faint"}`}>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
