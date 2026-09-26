import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Document list rows for <DocumentsPanel> — never loads file bytes. */
export async function docRows(where: Prisma.DocumentWhereInput) {
  const docs = await prisma.document.findMany({
    where,
    select: {
      id: true, fileName: true, category: true, mimeType: true, size: true, createdAt: true, uploadedById: true,
      uploadedBy: { select: { name: true } },
      project: { select: { projectNumber: true } },
      client: { select: { name: true } },
      lead: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return docs.map((d) => ({
    id: d.id, fileName: d.fileName, category: d.category, mimeType: d.mimeType, size: d.size,
    createdAt: d.createdAt.toISOString(), uploadedBy: d.uploadedBy.name, uploadedById: d.uploadedById,
    context: [d.project?.projectNumber, d.client?.name ?? d.lead?.name].filter(Boolean).join(" · ") || null,
  }));
}
