# Living 360 — Business Management App

Mobile-first business management PWA for Living 360 (interior design & execution studio),
covering the workflow: **New Lead → Follow-ups → Client Conversion → Site Visit → Quotation →
Agreement & Work Order → Project → Change of Scope → Invoice → Payment → Handover.**

## Stack

- **Next.js 14** (App Router, TypeScript, Server Components)
- **PostgreSQL + Prisma** for the data layer
- **NextAuth** (credentials) with a role-based permission matrix in `src/lib/permissions.ts`
- **Tailwind CSS**, brand tokens in `tailwind.config.ts`
- **@react-pdf/renderer** for letterhead PDFs (quotation, invoice, agreement, work order, change of scope)
- **ExcelJS** for Excel exports

See `PROJECT_REFERENCE.md` for the full feature list and architecture.

## Getting started (local)

```bash
cp .env.example .env      # fill in DATABASE_URL and NEXTAUTH_SECRET
npm install               # also runs prisma generate
npx prisma migrate dev    # creates the schema in your Postgres database
npm run seed              # one demo user per role + sample data + default letterhead settings
npm run check             # money-math self-check
npm run dev
```

Demo login after seeding: `superadmin@living360.in` / `Living360Demo!` — for local development only.

## Going live (production checklist)

1. **Database** — a managed Postgres (Neon, Supabase, RDS…). Take automatic daily backups; uploaded
   documents are stored in the database too.
2. **Environment variables**
   - `DATABASE_URL`
   - `NEXTAUTH_URL` = the public **https** address, e.g. `https://app.living360.in`
   - `NEXTAUTH_SECRET` = `openssl rand -base64 32` (the app refuses to share PDFs without it).
     Keep it stable — rotating it signs everyone out and invalidates all client share links.
3. **Build & release**
   ```bash
   npm ci
   npm run db:deploy        # prisma migrate deploy
   npm run build
   npm start
   ```
   Any Node 18+ host works (Vercel, Render, Railway, a VPS with PM2). Serve over HTTPS.
4. **First login** — do *not* run the demo seed in production. Create the first Super Admin:
   ```bash
   npm run create-admin -- "Your Name" you@living360.in "a-strong-password"
   ```
   Then sign in, open **Employees** to add the team, and **Settings** to fill in company details,
   letterhead, bank/UPI, signature, default terms and payment schedule. Use **Preview PDF**.
5. **Legal** — have your advisor review the default agreement clauses (Settings → Agreements)
   before sending the first agreement.
6. **Single server** — login lockout is kept in memory; if you run several instances, move it to Redis.

## Roles & permissions

Super Admin, Admin, Sales Manager, Sales Executive, Interior Designer, Project Manager, Site
Supervisor, Accountant, Viewer. The matrix and the discount-approval ceilings live in
`src/lib/permissions.ts`; every page and API route reads from it. Agreements, work orders and
changes of scope can be prepared by roles that can edit projects with financial access
(Super Admin, Admin, Project Manager). Only a Super Admin can delete employees.
