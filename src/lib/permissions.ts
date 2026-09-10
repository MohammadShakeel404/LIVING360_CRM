import { RoleName } from "@prisma/client";

export type Module =
  | "dashboard"
  | "leads"
  | "followups"
  | "clients"
  | "quotations"
  | "invoices"
  | "payments"
  | "projects"
  | "tasks"
  | "sitevisits"
  | "documents"
  | "employees"
  | "reports"
  | "settings";

export type Action = "view" | "create" | "edit" | "delete" | "export" | "financial";

type ModulePermissions = Record<Action, boolean>;
type PermissionMatrix = Record<Module, ModulePermissions>;

const ALL_TRUE: ModulePermissions = {
  view: true, create: true, edit: true, delete: true, export: true, financial: true,
};
const NONE: ModulePermissions = {
  view: false, create: false, edit: false, delete: false, export: false, financial: false,
};
const VIEW_ONLY: ModulePermissions = { ...NONE, view: true };

function full(overrides: Partial<Record<Module, Partial<ModulePermissions>>> = {}): PermissionMatrix {
  const modules: Module[] = [
    "dashboard", "leads", "followups", "clients", "quotations", "invoices",
    "payments", "projects", "tasks", "sitevisits", "documents", "employees",
    "reports", "settings",
  ];
  const base = Object.fromEntries(modules.map((m) => [m, { ...NONE }])) as PermissionMatrix;
  for (const m of modules) base[m] = { ...NONE, ...(overrides[m] ?? {}) };
  return base;
}

// Discount ceilings referenced by the quotation approval workflow (item 31 of the brief).
export const DISCOUNT_LIMITS: Record<RoleName, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 25,
  SALES_MANAGER: 10,
  SALES_EXECUTIVE: 5,
  INTERIOR_DESIGNER: 0,
  PROJECT_MANAGER: 0,
  SITE_SUPERVISOR: 0,
  ACCOUNTANT: 0,
  VIEWER: 0,
};

export const PERMISSIONS: Record<RoleName, PermissionMatrix> = {
  SUPER_ADMIN: full({
    dashboard: ALL_TRUE, leads: ALL_TRUE, followups: ALL_TRUE, clients: ALL_TRUE,
    quotations: ALL_TRUE, invoices: ALL_TRUE, payments: ALL_TRUE, projects: ALL_TRUE,
    tasks: ALL_TRUE, sitevisits: ALL_TRUE, documents: ALL_TRUE, employees: ALL_TRUE,
    reports: ALL_TRUE, settings: ALL_TRUE,
  }),

  ADMIN: full({
    dashboard: ALL_TRUE, leads: ALL_TRUE, followups: ALL_TRUE, clients: ALL_TRUE,
    quotations: ALL_TRUE, invoices: ALL_TRUE, payments: ALL_TRUE, projects: ALL_TRUE,
    tasks: ALL_TRUE, sitevisits: ALL_TRUE, documents: ALL_TRUE,
    employees: { view: true, create: true, edit: true, delete: false, export: true, financial: false },
    reports: ALL_TRUE, settings: { view: true, create: false, edit: true, delete: false, export: false, financial: false },
  }),

  SALES_MANAGER: full({
    dashboard: VIEW_ONLY,
    leads: { view: true, create: true, edit: true, delete: false, export: true, financial: true },
    followups: { view: true, create: true, edit: true, delete: true, export: true, financial: false },
    clients: { view: true, create: true, edit: true, delete: false, export: true, financial: true },
    quotations: { view: true, create: true, edit: true, delete: false, export: true, financial: true },
    invoices: VIEW_ONLY,
    payments: VIEW_ONLY,
    sitevisits: { view: true, create: true, edit: true, delete: false, export: false, financial: false },
    reports: { ...VIEW_ONLY, export: true },
  }),

  SALES_EXECUTIVE: full({
    dashboard: VIEW_ONLY,
    leads: { view: true, create: true, edit: true, delete: false, export: false, financial: true },
    followups: { view: true, create: true, edit: true, delete: false, export: false, financial: false },
    clients: { view: true, create: false, edit: false, delete: false, export: false, financial: false },
    quotations: { view: true, create: true, edit: true, delete: false, export: false, financial: true },
    sitevisits: { view: true, create: true, edit: true, delete: false, export: false, financial: false },
  }),

  INTERIOR_DESIGNER: full({
    dashboard: VIEW_ONLY,
    leads: VIEW_ONLY,
    clients: VIEW_ONLY,
    quotations: { view: true, create: true, edit: true, delete: false, export: false, financial: false },
    projects: VIEW_ONLY,
    tasks: { view: true, create: true, edit: true, delete: false, export: false, financial: false },
    documents: { view: true, create: true, edit: false, delete: false, export: false, financial: false },
  }),

  PROJECT_MANAGER: full({
    dashboard: VIEW_ONLY,
    clients: VIEW_ONLY,
    projects: { view: true, create: false, edit: true, delete: false, export: true, financial: true },
    tasks: { view: true, create: true, edit: true, delete: true, export: false, financial: false },
    sitevisits: { view: true, create: true, edit: true, delete: false, export: false, financial: false },
    documents: { view: true, create: true, edit: true, delete: false, export: false, financial: false },
    invoices: VIEW_ONLY,
  }),

  SITE_SUPERVISOR: full({
    dashboard: VIEW_ONLY,
    projects: VIEW_ONLY,
    tasks: { view: true, create: false, edit: true, delete: false, export: false, financial: false },
    sitevisits: { view: true, create: true, edit: true, delete: false, export: false, financial: false },
    documents: { view: true, create: true, edit: false, delete: false, export: false, financial: false },
  }),

  ACCOUNTANT: full({
    dashboard: VIEW_ONLY,
    clients: { view: true, create: false, edit: false, delete: false, export: true, financial: true },
    invoices: { view: true, create: true, edit: true, delete: false, export: true, financial: true },
    payments: { view: true, create: true, edit: true, delete: false, export: true, financial: true },
    reports: { ...VIEW_ONLY, export: true, financial: true },
  }),

  VIEWER: full({
    dashboard: VIEW_ONLY, leads: VIEW_ONLY, clients: VIEW_ONLY, projects: VIEW_ONLY, reports: VIEW_ONLY,
  }),
};

export function can(role: RoleName, module: Module, action: Action): boolean {
  return PERMISSIONS[role]?.[module]?.[action] ?? false;
}

export function hasFinancialAccess(role: RoleName, module: Module): boolean {
  return can(role, module, "financial");
}
