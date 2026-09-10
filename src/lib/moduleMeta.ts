import { FileText, Receipt, Wallet, Building2, MapPin, FolderOpen, UserCog, BarChart3, Settings, LucideIcon } from "lucide-react";

export const MODULE_META: Record<string, { icon: LucideIcon; title: string; note: string }> = {
  quotations: { icon: FileText, title: "Quotations", note: "Build itemized quotations from templates, route large discounts for approval, and generate branded PDFs on Living 360 letterhead." },
  invoices: { icon: Receipt, title: "Invoices", note: "Raise advance, stage-wise or final invoices linked directly to a quotation, with GST handled automatically." },
  payments: { icon: Wallet, title: "Payments", note: "Log payments against invoices and track outstanding balances per project." },
  projects: { icon: Building2, title: "Projects", note: "Track every project from planning through handover with a visual stage timeline." },
  sitevisits: { icon: MapPin, title: "Site Visits", note: "Schedule visits, capture measurements and photos, linked to the lead or project." },
  documents: { icon: FolderOpen, title: "Documents", note: "Client and project files organized by category, with fast search." },
  employees: { icon: UserCog, title: "Employees", note: "Manage roles, permissions and activity for everyone on the team — Super Admin only." },
  reports: { icon: BarChart3, title: "Reports", note: "Sales, follow-up and financial reports with custom date ranges." },
  settings: { icon: Settings, title: "Settings", note: "Letterhead, GST rates, pipeline stages and custom fields — configured by Super Admin." },
};
