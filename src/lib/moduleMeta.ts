import { HardHat, Clock, Users, MapPin, FileText, Receipt, Wallet, Building2, ListChecks, FolderOpen, UserCog, BarChart3, Settings, Flame, LucideIcon } from "lucide-react";
import type { Module } from "@/lib/permissions";

/** Modules listed on the mobile "More" screen, in display order. */
export const MORE_MODULES: { id: Module; icon: LucideIcon; title: string }[] = [
  { id: "leads", icon: Flame, title: "Leads" },
  { id: "followups", icon: Clock, title: "Follow-ups" },
  { id: "clients", icon: Users, title: "Clients" },
  { id: "sitevisits", icon: MapPin, title: "Site Visits" },
  { id: "quotations", icon: FileText, title: "Quotations" },
  { id: "invoices", icon: Receipt, title: "Invoices" },
  { id: "payments", icon: Wallet, title: "Payments" },
  { id: "projects", icon: Building2, title: "Projects" },
  { id: "workers", icon: HardHat, title: "Workers" },
  { id: "tasks", icon: ListChecks, title: "Tasks" },
  { id: "documents", icon: FolderOpen, title: "Documents" },
  { id: "employees", icon: UserCog, title: "Employees" },
  { id: "reports", icon: BarChart3, title: "Reports" },
  { id: "settings", icon: Settings, title: "Settings" },
];
