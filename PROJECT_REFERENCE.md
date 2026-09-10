# Living 360 — Business Management App
## Full Project Reference (paste this into any IDE/AI assistant to continue the build)

This document is the single source of truth for the project. It covers the brief, the
architecture, every file that exists today, what each one does, what's fully working vs.
stubbed, and the conventions to follow when adding more. Read this instead of asking the
user to re-explain the project.

---

## 1. What this is

Living 360 is an interior design and execution studio. This app is their internal business
management system — mobile-first, installable as a PWA, covering the full workflow:

**New Lead → Follow-ups → Client Conversion → Site Visit → Quotation → Project Management
→ Invoice → Payment → Project Completion**

It is explicitly *not* a marketing website or a generic admin dashboard — it's meant to feel
like a native business app on phone, tablet, and desktop, with fast data entry, bottom
navigation on mobile, and a proper application shell on desktop.

### Brand identity
- Primary Purple: `#523AB7`
- Secondary Gold: `#FEB73F`
- Dark Purple Accent: `#251A51`
- Font: **Afacad** (Google Fonts), used everywhere — no secondary typeface
- Supporting palette (chosen to fit, not in the original brief): success green `#1F9D66`,
  warning orange `#E8873D`, error red `#D64545`, app background `#F6F5FB`, ink (primary text)
  `#1D1730`, ink-soft (secondary text) `#6B6480`, line (borders) `#E8E4F2`

### Roles (9 total)
`SUPER_ADMIN`, `ADMIN`, `SALES_MANAGER`, `SALES_EXECUTIVE`, `INTERIOR_DESIGNER`,
`PROJECT_MANAGER`, `SITE_SUPERVISOR`, `ACCOUNTANT`, `VIEWER`. Every role has a
per-module `view / create / edit / delete / export / financial` permission set. See §5.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14, App Router, TypeScript, React Server Components |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Auth | NextAuth v4, Credentials provider, JWT session strategy |
| Styling | Tailwind CSS 3, brand tokens registered in `tailwind.config.ts` |
| Icons | `lucide-react` |
| Excel export | `exceljs` |
| Validation | `zod` (used in API route bodies) |
| Password hashing | `bcryptjs` |

No state management library — Server Components fetch data directly via Prisma; Client
Components hold local UI state only (search text, tab selection, form state). No React
Query / SWR yet — if you add data that needs client-side refetching/caching, that's the
natural next dependency to introduce.

---

## 3. Full file tree (as of last build) and what each file does

```
living360/
├── .env.example                     # DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
├── .gitignore
├── README.md                        # setup instructions + honest "what's stubbed" list
├── package.json
├── package-lock.json
├── tsconfig.json                    # paths: "@/*" -> "./src/*"
├── next.config.mjs
├── tailwind.config.ts               # brand colors as real Tailwind utilities (bg-primary, text-ink, etc.)
├── postcss.config.js
├── prisma/
│   ├── schema.prisma                # full data model — see §4
│   └── seed.ts                      # creates 1 user per role + sample leads/client/project/tasks
├── public/
│   └── manifest.json                # PWA manifest (name, icons, theme color, start_url)
└── src/
    ├── middleware.ts                # protects all routes except /login, /api/auth, static assets
    ├── types/
    │   └── next-auth.d.ts           # augments Session/JWT types with `id` and `role`
    ├── lib/
    │   ├── prisma.ts                # PrismaClient singleton (hot-reload safe)
    │   ├── auth.ts                  # NextAuth config: credentials provider, JWT/session callbacks
    │   ├── permissions.ts           # THE permission matrix — see §5. Single source of truth.
    │   ├── excel.ts                 # buildExcelWorkbook() + excelResponseHeaders() — shared by both export routes
    │   └── moduleMeta.ts            # icon/title/description for the 9 not-yet-built module stub pages
    ├── components/
    │   ├── AppShell.tsx             # 'use client' — sidebar (desktop/tablet) + top bar + bottom nav (mobile)
    │   ├── ui.tsx                   # shared primitives: Avatar, ScoreChip, PriorityChip, StatCard,
    │   │                             #   SectionHeader, EmptyState, formatCurrency(), initialsOf()
    │   └── ExportButton.tsx         # 'use client' — generic "fetch a file endpoint, trigger browser download" button
    └── app/
        ├── layout.tsx                # root layout — metadata, PWA manifest link, wraps <Providers>
        ├── providers.tsx             # 'use client' — wraps children in NextAuth <SessionProvider>
        ├── globals.css               # Afacad @import, Tailwind directives, CSS custom properties (unused now that Tailwind tokens exist, kept for reference)
        ├── page.tsx                  # "/" — redirects to /dashboard (middleware bounces unauth'd users to /login first)
        ├── login/
        │   └── page.tsx              # 'use client' — email/password form calling next-auth signIn()
        ├── api/
        │   ├── auth/[...nextauth]/route.ts   # NextAuth handler (GET/POST)
        │   ├── leads/
        │   │   ├── route.ts          # GET (list, filtered+scoped+permission-checked), POST (create)
        │   │   │                     #   exports buildLeadWhere() — reused by the export route
        │   │   ├── [id]/route.ts     # GET / PATCH / DELETE a single lead
        │   │   └── export/route.ts   # GET — streams .xlsx (THE feature the user asked for)
        │   └── clients/
        │       ├── route.ts          # GET (list) — exports buildClientWhere()
        │       └── export/route.ts   # GET — streams .xlsx
        └── (app)/                    # route group — every page in here is wrapped by AppShell + auth-checked
            ├── layout.tsx             # server component: getServerSession(), redirect('/login') if none, renders <AppShell>
            ├── dashboard/page.tsx     # server component, live Prisma aggregates, role-scoped
            ├── leads/
            │   ├── page.tsx           # server component: permission check + initial Prisma fetch, hands off to client
            │   ├── LeadsClient.tsx    # 'use client' — search, List/Pipeline toggle, renders <ExportButton>, <NewLeadSheet>
            │   ├── NewLeadSheet.tsx   # 'use client' — 2-step bottom-sheet form, POSTs to /api/leads
            │   └── [id]/page.tsx      # server component — full lead detail (contact actions, info, follow-up history)
            ├── clients/
            │   ├── page.tsx           # server component: permission check + Prisma fetch
            │   └── ClientsClient.tsx  # 'use client' — search + <ExportButton>
            ├── followups/
            │   ├── page.tsx           # server component — queries FollowUp for today/overdue/upcoming
            │   └── FollowupsClient.tsx# 'use client' — tab switcher
            ├── tasks/page.tsx         # server component — Task list, role-scoped for Site Supervisor/Interior Designer
            ├── more/page.tsx          # mobile-only grid linking to the 9 stub modules
            └── {quotations,invoices,payments,projects,sitevisits,documents,employees,reports,settings}/page.tsx
                                       # each is a server component rendering <EmptyState> from moduleMeta.ts — NOT built out yet
```

---

## 4. Data model (`prisma/schema.prisma`)

Postgres via Prisma. Full entity list:

- **User** — employee record. Fields: name, email, phone, passwordHash, `role` (enum
  `RoleName`), status (ACTIVE/INACTIVE), joiningDate, `maxDiscountPct`. Has relations to
  everything it can own/be assigned (`assignedLeads`, `followUps`, `quotationsCreated`,
  `managedProjects`, `tasksAssigned`, `siteVisitsAssigned`, `documentsUploaded`,
  `notifications`, `activity`).
- **Lead** — `leadNumber` (unique, e.g. `LD-1001`), name, phone, whatsapp, email, location,
  address, `source` (enum `LeadSource`), propertyType, propertySize, bedrooms, projectType,
  budgetMin/budgetMax (Decimal), projectLocation, possessionDate, expectedStartDate, `stage`
  (enum `LeadStage`, 11 values from `NEW_LEAD` to `CONVERTED`/`LOST`), `score` (enum
  `LeadScore`: HOT/WARM/COLD), lostReason, assignedToId → User, nextFollowUpAt. Has many
  `FollowUp`, `SiteVisit`, `Quotation`, `Document`; has one optional `Client`.
- **FollowUp** — belongs to Lead. type (enum `FollowUpType`: CALL/WHATSAPP/EMAIL/MEETING/
  SITE_VISIT/VIDEO_CALL), scheduledAt, completedAt, status (enum `FollowUpStatus`), outcome,
  notes, createdById → User.
- **Client** — created when a Lead converts. `clientNumber` (unique), 1:1 `leadId`, name,
  phone, email, convertedAt. Has many Quotation, Invoice, Project, Document.
- **Quotation** — `quotationNumber` (unique), version, `supersedesId` (self-versioning for
  revisions), optional leadId/clientId, salespersonId → User, status (enum
  `QuotationStatus`: DRAFT/SENT/VIEWED/APPROVED/REJECTED/EXPIRED), validUntil,
  termsAndConditions, discountPct, `requiresApproval` (bool), approvedById. Has many
  `QuotationItem` and `Invoice`.
- **QuotationItem** — category, name, description, quantity, unit, rate, discountPct,
  gstPct (default 18), sortOrder.
- **Invoice** — `invoiceNumber` (unique), clientId, optional quotationId/projectId, `type`
  (enum `InvoiceType`: ADVANCE/STAGE_WISE/FINAL/CUSTOM), status (enum `InvoiceStatus`),
  invoiceDate, dueDate, totalAmount. Has many `Payment`.
- **Payment** — invoiceId, amount, `method` (enum `PaymentMethod`: CASH/UPI/BANK_TRANSFER/
  CHEQUE/CARD/OTHER), referenceNumber, notes, paidAt.
- **Project** — `projectNumber` (unique), clientId, projectManagerId → User, siteLocation,
  startDate, expectedCompletion, budget, value, `stage` (enum `ProjectStage`, 9 values
  PLANNING → COMPLETED). Has many Task, Invoice, SiteVisit, Document.
- **Task** — optional projectId, title, description, assigneeId → User, `priority` (enum
  `TaskPriority`: LOW/MEDIUM/HIGH/URGENT), dueDate, `status` (enum `TaskStatus`: TODO/
  IN_PROGRESS/WAITING/COMPLETED).
- **SiteVisit** — optional leadId/projectId, scheduledAt, assignedToId → User, notes,
  measurements (Json), photoUrls (Json).
- **Document** — optional leadId/clientId/projectId, category, fileName, url,
  uploadedById → User.
- **Notification** — userId, text, tone (string: primary/success/warning/error), read (bool).
- **ActivityLog** — userId, action (string, e.g. `"LEAD_CREATED"`), entityType, entityId,
  metadata (Json).

All models have `createdAt`/`updatedAt` where relevant, and indexes on the fields actually
queried (stage, score, assignedToId, phone, status, etc.) — check the schema before adding
a new query pattern that isn't indexed yet.

**Not yet run against a real database in this environment** — `prisma generate` requires
downloading a query-engine binary from `binaries.prisma.sh`, which was blocked by the build
sandbox's network allowlist. This is an environment limitation only; on a normal machine
`npm install && npx prisma generate && npx prisma migrate dev` will work fine. All
TypeScript files were verified to compile and bundle correctly with esbuild against the
real `node_modules`, but full Prisma-typed `tsc --noEmit` has not been run yet — do that
first thing when you pick this back up, since Prisma's generated types are stricter than
what esbuild checks.

---

## 5. Auth & permissions (`src/lib/auth.ts`, `src/lib/permissions.ts`)

- **Auth**: NextAuth credentials provider. `authorize()` looks up `User` by email, checks
  `status === ACTIVE`, compares password with `bcrypt.compare`. JWT/session callbacks attach
  `id` and `role` onto the session so `session.user.role` is available everywhere
  (`src/types/next-auth.d.ts` types this).
- **Middleware** (`src/middleware.ts`) protects every route except `/login`, `/api/auth/*`,
  and static assets — unauthenticated requests are redirected to `/login`.
- **Permission matrix** (`src/lib/permissions.ts`) is the single source of truth. Shape:
  ```ts
  type Module = "dashboard" | "leads" | "followups" | "clients" | "quotations" |
    "invoices" | "payments" | "projects" | "tasks" | "sitevisits" | "documents" |
    "employees" | "reports" | "settings";
  type Action = "view" | "create" | "edit" | "delete" | "export" | "financial";
  can(role, module, action) => boolean
  ```
  `PERMISSIONS[role]` is built with a `full({ moduleName: {...overrides} })` helper — modules
  not mentioned default to all-`false`. `DISCOUNT_LIMITS[role]` holds the per-role discount
  ceiling used for the quotation approval workflow (Super Admin 100%, Admin 25%, Sales
  Manager 10%, Sales Executive 5%, everyone else 0% — they can't discount at all).

**Convention — every API route and every server-component page must call
`can(session.user.role, module, action)` and return/render a 403 or `<EmptyState icon={Lock}
.../>` if it fails.** Don't rely on the UI hiding a button; the route itself has to refuse.
Look at `src/app/api/leads/route.ts` or `src/app/(app)/leads/page.tsx` as the reference
pattern for this.

**Sales Executive row-level scoping**: in addition to module permissions, Sales Executives
only see leads/follow-ups assigned to them (`assignedToId: session.user.id` merged into the
`where` clause). This is done manually in each query right now (see `leads/page.tsx`,
`api/leads/route.ts`, `dashboard/page.tsx`, `followups/page.tsx`) — if you add more modules
with the same row-level rule, consider centralizing this into a helper in `permissions.ts`
rather than repeating the `role === "SALES_EXECUTIVE" ? {...} : {}` pattern by hand.

---

## 6. The page pattern (follow this for every new module)

Every real (non-stub) module follows the same shape — **do not deviate** unless you have a
reason to:

1. **`page.tsx`** (Server Component): `getServerSession(authOptions)`, check `can(role,
   module, "view")` and return an `<EmptyState icon={Lock} .../>` early if it fails, fetch
   initial data straight from `prisma`, shape/serialize it (Decimals and Dates need
   `.toString()`/`.toISOString()` before passing to a Client Component — Server Components
   can pass Dates but Client Components serialize props over the RSC boundary as JSON, so
   Decimal objects will break; see how `leads/page.tsx` does it), then render a
   `'use client'` component passing that data plus permission booleans as props (e.g.
   `canExport`, `canCreate`, `financialAccess`).
2. **`<Module>Client.tsx`** (Client Component): owns local UI state (search text, tab/view
   toggle), renders the list/grid, includes `<ExportButton endpoint="/api/<module>/export?..."
   />` if `canExport` is true, and any create/edit forms that POST/PATCH back to the API
   routes.
3. **API routes** in `src/app/api/<module>/`: `route.ts` for the collection (GET list + POST
   create), `[id]/route.ts` for a single record (GET/PATCH/DELETE), `export/route.ts` if the
   module needs Excel export. Every handler re-checks `getServerSession` +
   `can(role, module, action)` — **never trust the page-level check alone**, the API is a
   separate trust boundary.
4. **Financial gating**: any module with a `financial` permission (leads, clients now;
   quotations/invoices/payments/projects will need it too) must strip money fields from the
   response server-side when `can(role, module, "financial")` is false — not just hide them
   in CSS. See how `api/leads/route.ts` nulls out `budgetMin`/`budgetMax`.

---

## 7. Excel export (the feature most recently added)

`src/lib/excel.ts` exports:
- `buildExcelWorkbook({ sheetName, title, subtitle, columns, rows })` → returns a `Buffer`.
  Uses `exceljs`, styles the title row with the brand purple and the header row with brand
  gold, adds an autofilter, sets column widths. `columns` is
  `{ header, width?, value: (row) => cellValue, numFmt? }[]` — fully generic, works for any
  row shape.
- `excelResponseHeaders(filename)` → the two headers (`Content-Type`,
  `Content-Disposition: attachment`) an API route needs to return to trigger a download.

Pattern for adding export to a new module (copy `src/app/api/leads/export/route.ts`):
1. Reuse the same `buildXWhere()` filter function the list route already exports, so the
   exported file always matches whatever the user currently has filtered/searched on screen.
2. Check `can(role, module, "export")`, 403 with a clear message if not.
3. Fetch full rows (no `take` limit — the list view paginates/limits to 200, exports
   shouldn't).
4. Build a `columns` array; conditionally spread in money columns only when
   `can(role, module, "financial")` is true.
5. Return `new NextResponse(buffer, { headers: excelResponseHeaders(filename) })`.

Frontend side: `<ExportButton endpoint="/api/leads/export?q=...">` (see
`src/components/ExportButton.tsx`) — it's fully generic, `fetch`es the endpoint, reads the
filename off `Content-Disposition`, and triggers a browser download via a Blob URL. Reuse it
as-is for every future export button; don't write a new download handler per module.

---

## 8. Design system conventions

- Brand colors are real Tailwind utilities via `tailwind.config.ts` —
  `bg-primary`, `text-ink-soft`, `bg-danger-bg`, `border-line`, etc. **Don't inline hex
  colors** in new components; extend `tailwind.config.ts` if you need a new token.
  `borderRadius.xl2` (`14px`) is the standard card corner radius — used everywhere via
  `rounded-xl2`.
- Font is Afacad, loaded via `@import` in `globals.css` — already global, don't re-import
  per component.
- Layout shell: `AppShell.tsx` renders a dark-purple (`bg-dark`) collapsible sidebar with
  grouped nav (`SIDEBAR_GROUPS` constant) on `md:` and above, and a 5-tab bottom bar +
  floating primary-purple "+" button on mobile (`BOTTOM_TABS` constant). **If you add a new
  top-level module, add it to both `SIDEBAR_GROUPS` in `AppShell.tsx` and, if it should be
  reachable on mobile, to the `/more` grid (`src/lib/moduleMeta.ts` +
  `app/(app)/more/page.tsx`)** — these are not auto-generated from routes.
- Shared primitives live in `src/components/ui.tsx` (`Avatar`, `ScoreChip`, `PriorityChip`,
  `StatCard`, `SectionHeader`, `EmptyState`, `formatCurrency`, `initialsOf`). Use these
  instead of rebuilding avatar circles / chips / empty states inline.
- Bottom sheets (mobile forms) follow the pattern in `NewLeadSheet.tsx`: fixed overlay +
  `rounded-t-[20px]` sheet sliding from the bottom, a drag handle bar, step indicator dots,
  sticky footer with the primary action button. Reuse this shape for the New Quotation / New
  Invoice / New Task quick-add flows.

---

## 9. What's fully implemented right now

- Auth (login, session, middleware protection, role in session)
- Full RBAC permission matrix, enforced at both page and API level
- Dashboard — role-aware live stats (hot leads, today's follow-ups, pending quotations,
  monthly revenue gated by financial permission), "Attention Required" overdue-lead panel
- Leads — list (search), Pipeline board (11 stages), lead detail page (contact actions,
  info, follow-up history), quick-add 2-step form with duplicate-phone detection,
  **Excel export**
- Clients — list (search), **Excel export**
- Follow-ups — Today / Overdue / Upcoming tabs
- Tasks — list with priority chips, role-scoped for Site Supervisor / Interior Designer
- Seed script — 1 user per all 9 roles, 6 sample leads across different stages/scores, 1
  converted client + project + 2 tasks

## 10. What's NOT implemented yet (stub pages only, schema already supports them)

Quotations, Invoices, Payments, Projects, Site Visits, Documents, Employees, Reports,
Settings — each currently renders a static `<EmptyState>` from `moduleMeta.ts`. None have
API routes yet. Suggested build order, since each depends on the last:

1. **Quotations** — the workflow is stuck without this. Needs: quotation builder UI (item
   line editor against `QuotationItem`), the discount-approval workflow using
   `DISCOUNT_LIMITS` from `permissions.ts` (a quotation with `discountPct` over the
   salesperson's limit should set `requiresApproval: true` and block sending until an
   Admin/Super Admin approves), and PDF/letterhead generation (not started — will need a
   PDF library; `@react-pdf/renderer` or generating HTML and using a headless-browser PDF
   service are the two common approaches; letterhead config — logo, GST/PAN, bank details,
   signature — needs its own Settings-module table, which doesn't exist in the schema yet
   and should be added).
2. **Invoices** — straightforward once Quotations exist; an Invoice mostly copies items from
   an approved Quotation. Needs its own PDF generation too (reuse whatever approach is built
   for Quotations).
3. **Payments** — simple CRUD against `Invoice`; the running-balance /
   "outstanding amount" calculation is derived (`invoice.totalAmount - sum(payments)`), not
   stored — write that as a small utility function, not duplicated inline math.
4. **Projects** — mostly ready to build directly; `Project` already has everything needed
   (stage, budget, value, projectManager). The visual stage timeline (Planning → Completed)
   is the main new UI piece.
5. **Site Visits, Documents** — Documents needs real file storage (S3/Cloudflare R2/etc.)
   wired in; nothing in the schema or app currently uploads a file anywhere.
6. **Employees** — Super Admin/Admin only CRUD over `User` + role assignment. Straightforward
   given the permission matrix already exists.
7. **Reports** — aggregation queries over existing data; no new schema needed, just charts
   (recharts is already an approved dependency in most Claude environments if you're
   building this back in an artifact-style tool, otherwise install it) plus date-range
   filtering.
8. **Settings** — pipeline stage customization, GST rates, custom fields, letterhead config.
   This is the one module that needs *new* schema (a settings/config table) since the brief
   asks for these to be configurable without code changes — currently pipeline stages
   (`LeadStage` enum) and everything else are hardcoded in the Prisma schema and would
   require a migration to change. If "Super Admin can customize without code changes" is a
   hard requirement, this is the biggest architectural gap to close and worth doing before
   client demos, not after.

Also not started: PWA offline support (manifest exists, no service worker yet — needs a
caching strategy, `next-pwa` or a hand-rolled service worker), WhatsApp Business API /
Meta Lead Ads / other future integrations (§39 of the original brief), export for anything
beyond Leads/Clients (Quotations/Invoices/Payments/Projects should get the same
`buildExcelWorkbook` treatment once they exist).

---

## 11. Setup

```bash
cp .env.example .env       # set DATABASE_URL (Postgres) and NEXTAUTH_SECRET
npm install
npx prisma generate
npx prisma migrate dev     # creates the schema
npm run seed                # demo users + sample data
npm run dev
```

Demo login after seeding: `superadmin@living360.in` / `Living360Demo!` (seeded in plaintext
in `prisma/seed.ts` for local dev only — never ship that to production).

---

## 12. Known gaps / things to double check when resuming

- Full `tsc --noEmit` against generated Prisma types hasn't run yet (blocked in the build
  sandbox — see §4). Run it first.
- No automated tests exist anywhere in the project yet.
- No CI config.
- No rate limiting / brute-force protection on the login route.
- Prisma `Decimal` fields are being `.toString()`'d manually at each server/client boundary
  — if this gets error-prone as more modules are added, consider a small serialization
  helper instead of repeating it.
- `globals.css` still has the old CSS-custom-property color tokens left over from before
  Tailwind was wired in properly — they're unused now that `tailwind.config.ts` has the real
  tokens; safe to delete, kept only for reference.
