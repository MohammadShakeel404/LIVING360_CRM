import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { InvoiceEditor } from "../../InvoiceEditor";
import { loadInvoiceClients } from "../../editorData";

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "invoices", "edit") || !can(role, "invoices", "financial")) {
    return <EmptyState icon={Lock} title="No access" note="Your role can't edit invoices." />;
  }
  const inv = await prisma.invoice.findUnique({ where: { id: params.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!inv) notFound();
  if (inv.status !== "DRAFT") redirect(`/invoices/${inv.id}`);

  return (
    <InvoiceEditor
      clients={await loadInvoiceClients(inv.id)}
      initial={{
        id: inv.id,
        clientId: inv.clientId,
        quotationId: inv.quotationId ?? "",
        projectId: inv.projectId ?? "",
        changeOrderId: inv.changeOrderId ?? "",
        type: inv.type,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? "",
        notes: inv.notes ?? "",
        items: inv.items.map((i) => ({
          description: i.description, hsnSac: i.hsnSac ?? "", quantity: i.quantity.toString(), unit: i.unit,
          rate: i.rate.toString(), gstPct: String(Number(i.gstPct)),
        })),
      }}
    />
  );
}
