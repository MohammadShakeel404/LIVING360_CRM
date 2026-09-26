import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { InvoiceEditor } from "../InvoiceEditor";
import { loadInvoiceClients } from "../editorData";

export default async function NewInvoicePage({ searchParams }: { searchParams: { quotationId?: string; clientId?: string; projectId?: string; changeOrderId?: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "invoices", "create") || !can(role, "invoices", "financial")) {
    return <EmptyState icon={Lock} title="No access" note="Your role can't create invoices." />;
  }

  const clients = await loadInvoiceClients();
  let clientId = searchParams.clientId ?? "";
  if (searchParams.quotationId) {
    const q = await prisma.quotation.findUnique({ where: { id: searchParams.quotationId }, select: { clientId: true } });
    clientId = q?.clientId ?? clientId;
  }
  const today = new Date();
  return (
    <InvoiceEditor
      clients={clients}
      initial={{
        clientId,
        quotationId: searchParams.quotationId ?? "",
        projectId: searchParams.projectId ?? "",
        changeOrderId: searchParams.changeOrderId ?? "",
        type: "ADVANCE",
        invoiceDate: today.toISOString().slice(0, 10),
        dueDate: new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10),
        notes: "",
        items: [],
      }}
    />
  );
}
