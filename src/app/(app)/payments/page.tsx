import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { PaymentsClient } from "./PaymentsClient";

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "payments", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Your role doesn't have permission to view payments." />;
  }
  const financial = can(role, "payments", "financial");
  const payments = await prisma.payment.findMany({
    include: { invoice: { select: { id: true, invoiceNumber: true, client: { select: { name: true } } } } },
    orderBy: { paidAt: "desc" },
    take: 500,
  });
  return (
    <PaymentsClient
      canExport={can(role, "payments", "export")}
      financial={financial}
      rows={payments.map((p) => ({
        id: p.id,
        amount: financial ? Number(p.amount) : null,
        method: p.method,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        paidAt: p.paidAt.toISOString(),
        invoiceId: p.invoice.id,
        invoiceNumber: p.invoice.invoiceNumber,
        clientName: p.invoice.client.name,
      }))}
    />
  );
}
