// Creates (or resets) a Super Admin. Usage:
//   npm run create-admin -- "Full Name" email@company.in "a-strong-password"
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) throw new Error('Usage: npm run create-admin -- "Full Name" email password');
  if (password.length < 10) throw new Error("Use a password of at least 10 characters.");

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null, maxDiscountPct: 100 },
    create: { name, email: email.toLowerCase(), passwordHash, role: "SUPER_ADMIN", maxDiscountPct: 100 },
  });
  await prisma.companySettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  console.log(`Super Admin ready: ${user.email}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  const msg = String(e?.message ?? e);
  const hint =
    /does not exist/i.test(msg) ? "The database tables aren't created yet. Run:  npx prisma migrate deploy  (with the same DATABASE_URL), then try again." :
    /Can't reach database|P1001|ENOTFOUND|timed out/i.test(msg) ? "Can't connect to the database. Check the DATABASE_URL link (copy it again from Neon with connection pooling OFF)." :
    /authentication failed|password authentication/i.test(msg) ? "The database username/password in DATABASE_URL is wrong. Copy the link again from Neon." :
    null;
  console.error(hint ? `\n❌ ${hint}\n` : msg);
  process.exit(1);
});
