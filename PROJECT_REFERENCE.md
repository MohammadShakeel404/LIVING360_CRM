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

- **InvoiceItem** — invoice lines: description, hsnSac, quantity, unit, rate, gstPct. `Invoice.totalAmount`
  is always recomputed server-side from these lines. Invoice also has `notes`.
- **CompanySettings** — single row (`id = "default"`, read via `getCompanySettings()`): company details,
  GSTIN/PAN, logo / letterhead header / footer / signature as PNG/JPEG data URLs, bank + UPI, signatory,
  default quotation/invoice terms, quotation validity days.
- **Client** also has `address` and `gstin`; **SiteVisit** has `completedAt`; **Document** stores the file
  in `data` (bytes) with `mimeType` and `size`.

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

- **Auth**: login, JWT session, middleware protection. Role/status re-checked from the DB every 60s
  (`src/lib/auth.ts` jwt callback) — deactivating an employee or changing their role takes effect
  within a minute. 5 failed logins per email → 10-minute lockout (in-memory).
- **RBAC** enforced at page and API level; sidebar, bottom bar and More screen only show modules the
  role can view.
- **Dashboard** — role-aware cards (hot leads, today's follow-ups, quotations awaiting client,
  collections, outstanding, active projects, my tasks), discount-approval banner for admins.
- **Global search** (`/search`) across leads, clients, quotations, invoices (role-scoped).
- **Leads** — list with score filter, pipeline board, detail page with stage/score change, edit,
  follow-up log/schedule, convert to client (`POST /api/leads/[id]/convert`), mark lost, delete.
  Lead PATCH uses a zod allow-list (no mass assignment).
- **Follow-ups** — Today / Overdue / Upcoming / Completed with mark-done / cancel.
  `Lead.nextFollowUpAt` is kept in sync by `src/lib/followups.ts`.
- **Clients** — list + detail (projects, quotations, invoices, billed/received/outstanding), edit
  billing address + GSTIN (printed on PDFs).
- **Quotations** — full-page editor (rooms/categories, line + overall discount, GST per line),
  edit drafts, discount approval (effective discount vs `DISCOUNT_LIMITS`), mark sent → client
  accepted/rejected, revisions (`QT-…-R2`, the old one expires), delete. All money math lives in
  `src/lib/totals.ts` (run `npm run check`).
- **Letterhead + PDFs** — Settings → Letterhead: either a designed header from company details + logo,
  or an uploaded header/footer image placed edge-to-edge on every page. Bank/UPI box, signatory
  + signature image, default terms. PDFs are rendered server-side with `@react-pdf/renderer` and the
  Afacad TTFs in `src/assets/fonts` (`src/lib/pdf.tsx`; data mapping in `src/lib/documentPdf.ts`).
- **Sharing** — Download PDF, Preview, native share sheet (sends the PDF file on phones), WhatsApp,
  email, copy link. Client links are `/share/{quotation|invoice|agreement|workorder|cos}/{id}?t=…` — HMAC-signed with
  `NEXTAUTH_SECRET`, no login needed, excluded in `middleware.ts`. Rotating the secret revokes all links.
- **Invoices** — `InvoiceItem` lines with HSN/SAC + GST; create from a quotation (copy all items or
  bill X% split by GST rate), blocked from exceeding what's left to bill on the quotation; issue,
  edit draft, cancel/reopen, due date, delete. OVERDUE is derived from the due date at read time
  (`effectiveInvoiceStatus` in `src/lib/invoices.ts`).
- **Payments** — record against an invoice (can't exceed balance), status auto-updates, admins can
  remove a payment; Payments page with method filter + export.
- **Projects** — list with progress, create from client (value defaults to accepted quotation),
  detail with stage timeline / advance stage, PM + dates, tasks, invoices, site visits, documents.
- **Agreement & work order** (`Agreement` model, one active per project) — created from the
  client's accepted quotation on the project page (`/projects/[id]/agreement`): dates, payment
  milestones (must total 100%), exclusions, work-order instructions, numbered terms (defaults in
  Settings → Agreements). The same record prints two PDFs: the Agreement (intro, clauses, payment
  schedule, two-party signatures, Annexure A scope) and the Work Order (scope, schedule, sign-off).
  Draft → Sent → Signed (locked) / Cancelled. PDFs in `src/lib/contractPdf.ts`.
- **Change of scope (COS)** (`ChangeOrder` + `ChangeOrderItem`) — additions and deductions with GST
  per line, reason, timeline impact (days). Draft → Sent → Client approved / Rejected. Approval adds
  the net amount to `Project.value` and shifts `expectedCompletion`. Approved COS can be invoiced
  (`Invoice.changeOrderId`), capped at the COS net. Maths in `changeOrderTotals` (`src/lib/contracts.ts`).
- **Workers & labour cost** (`Worker`, `ProjectWorker`, `WorkerStage`, `WorkerPayment`; permission
  module `workers`) — worker profiles (trade, phone, ID, UPI/bank, usual rate) at `/workers`.
  A worker is engaged on a project with a scope and pay basis: fixed amount, per day (rate × days)
  or per unit (rate × sq.ft/r.ft/nos); the payable is stored in `agreedAmount`. Optional stage plan
  whose amounts must equal the payable. Payments are recorded against a stage or as direct/advance
  (receipt no. `WP-YYYY-NNNN`), can never exceed the balance, and each has a letterhead receipt PDF
  (shareable to the worker on WhatsApp). Worker statement PDF, project labour-cost statement PDF
  (by trade and by worker, % of contract value), Excel export, "Labour due" dashboard card.
  All maths in `assignmentSummary` / `labourSummary` (`src/lib/workers.ts`, covered by `npm run check`).
  Site supervisors see who is on site but no amounts; project managers and accountants can pay;
  only admins delete payments. Workers with history can only be marked inactive, not deleted.
- **Tasks** — shared `TaskBoard` (tasks page + project page): create/edit/complete/delete.
- **Site visits** — schedule for a lead or project, reschedule, complete with measurements; moves
  the lead's stage forward automatically.
- **Documents** — upload (≤10 MB, stored in Postgres `Document.data`), preview/download, delete.
- **Employees** — add, edit role/status, reset password, delete (Super Admin only). Delete unassigns
  open leads/tasks/visits/projects; employees with history are anonymised and hidden (`User.deletedAt`)
  so past records keep their author. At least one active Super Admin is always kept.
- **Confirmations** use the in-app `ask()` dialog (`src/components/confirm.tsx`), never
  `window.confirm/prompt` — those are silently blocked in installed PWAs and some browsers.
- **Production**: security headers in `next.config.mjs`, `error.tsx` / `loading.tsx` / `not-found.tsx`,
  `npm run db:deploy`, `npm run create-admin`. See README → Going live.
- **Reports** — date presets, leads by source, pipeline, win rate, quoted/invoiced/collected,
  outstanding, 6-month collections, sales team table.
- Excel export for leads, clients, quotations, invoices, payments.

## 10. What's NOT implemented yet

- Custom pipeline stages / custom fields (stages are still the `LeadStage` enum).
- GST split into CGST/SGST vs IGST on PDFs (shown as a single GST line).
- In-app notifications feed (the bell shows computed alerts, not the `Notification` table).
- PWA offline support (manifest + icon exist, no service worker).
- WhatsApp Business API / Meta Lead Ads integrations; "viewed" tracking of share links.
- Documents live in Postgres — move to S3/R2 if volume grows.

## 11. Setup

```bash
cp .env.example .env       # set DATABASE_URL (Postgres) and NEXTAUTH_SECRET
npm install
npx prisma generate
npx prisma migrate dev     # creates the schema
npm run seed                # demo users + sample data + default letterhead settings
npm run check               # money-math self-check (src/lib/totals.check.ts)
npm run dev
```

Demo login after seeding: `superadmin@living360.in` / `Living360Demo!` (seeded in plaintext
in `prisma/seed.ts` for local dev only — never ship that to production).

---

## 12. Known gaps / things to double check when resuming

- `tsc --noEmit` and `next build` both pass against the generated Prisma client.
- Only automated check is `npm run check` (money math). No end-to-end tests.
- No CI config.
- Login lockout is in-memory per server instance; use Redis if you run multiple instances.
- Prisma `Decimal` fields are being `.toString()`'d manually at each server/client boundary
  — if this gets error-prone as more modules are added, consider a small serialization
  helper instead of repeating it.
- `globals.css` still has the old CSS-custom-property color tokens left over from before
  Tailwind was wired in properly — they're unused now that `tailwind.config.ts` has the real
  tokens; safe to delete, kept only for reference.
