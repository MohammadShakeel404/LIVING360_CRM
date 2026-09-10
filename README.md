# Living 360 — Business Management App

Mobile-first business management PWA for Living 360 (interior design & execution studio),
covering the workflow: **New Lead → Follow-ups → Client Conversion → Site Visit → Quotation →
Project Management → Invoice → Payment → Project Completion.**

## Stack

- **Next.js 14** (App Router, TypeScript, Server Components)
- **PostgreSQL + Prisma** for the data layer
- **NextAuth** (credentials) for authentication, with a role-based permission matrix in `src/lib/permissions.ts`
- **Tailwind CSS**, brand tokens in `tailwind.config.ts`
- **ExcelJS** for the Leads and Clients "Export to Excel" buttons

## What's implemented vs. stubbed

Fully wired end-to-end (real database, real permission checks, real UI):

- Auth + role-based access control (9 roles, per-module view/create/edit/delete/export/financial flags)
- Dashboard (role-aware stats, attention-required panel)
- Leads (list, pipeline board, detail page, quick-add form, duplicate-phone detection, **Excel export**)
- Clients (list, **Excel export**)
- Follow-ups (today / overdue / upcoming)
- Tasks

Modeled in the database and present in navigation, but UI is a placeholder pending a follow-up build:
Quotations, Invoices, Payments, Projects, Site Visits, Documents, Employees, Reports, Settings.
The Prisma schema already has full tables for all of these — building out their screens is mostly
front-end + API route work following the same pattern as Leads/Clients.

Not yet built: quotation PDF/letterhead generation, WhatsApp/email integrations, offline
service-worker sync (the PWA manifest is in place; a service worker with a caching strategy is the
remaining piece), and file upload storage for documents/site-visit photos (needs an object storage
provider — S3, Cloudflare R2, etc. — wired into the Documents module).

## Getting started

```bash
cp .env.example .env      # fill in DATABASE_URL and NEXTAUTH_SECRET
npm install
npm run prisma:generate
npm run prisma:migrate    # creates the schema in your Postgres database
npm run seed               # creates one demo user per role + sample leads/clients
npm run dev
```

Demo login after seeding: `superadmin@living360.in` / `Living360Demo!` (change this immediately —
it's seeded in plain text in `prisma/seed.ts` for local development only).

## Excel export

`GET /api/leads/export` and `GET /api/clients/export` stream a `.xlsx` file built with ExcelJS,
styled with the Living 360 palette, honoring the same search filters as the on-screen list and
gated by the requesting user's `export` and `financial` permissions (budget/value columns are
omitted entirely for roles without financial access — not just hidden client-side).

## Roles & permissions

Roles: Super Admin, Admin, Sales Manager, Sales Executive, Interior Designer, Project Manager,
Site Supervisor, Accountant, Viewer. The full matrix — and the discount-approval ceilings per
role — lives in `src/lib/permissions.ts`. Change it there; every API route and page reads from
this single source of truth rather than checking roles ad hoc.

## Deploying

Any Node host that supports Next.js works (Vercel is the path of least resistance). You'll need
a managed Postgres instance (Neon, Supabase, RDS, etc.) — set `DATABASE_URL` and `NEXTAUTH_SECRET`
as environment variables, run `prisma migrate deploy` as part of your build/release step, and seed
production data separately from the dev seed script above.
