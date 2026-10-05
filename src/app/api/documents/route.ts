import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

// Vercel rejects request bodies over ~4.5 MB, so cap uploads just under it.
const MAX_BYTES = 4 * 1024 * 1024;

/** Multipart upload: file + category + optional projectId / clientId / leadId. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "documents", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file to upload." }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be 4 MB or smaller. Compress large photos or PDFs first." }, { status: 413 });

  const str = (k: string) => (form.get(k)?.toString().trim() || null);
  const [projectId, clientId, leadId] = [str("projectId"), str("clientId"), str("leadId")];
  // Derive the client from the project so documents show up on both.
  const project = projectId ? await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } }) : null;
  if (projectId && !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const doc = await prisma.document.create({
    data: {
      category: str("category") ?? "General",
      fileName: file.name.slice(0, 200),
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
      projectId,
      clientId: clientId ?? project?.clientId ?? null,
      leadId,
      uploadedById: session.user.id,
    },
    select: { id: true, fileName: true },
  });
  await prisma.document.update({ where: { id: doc.id }, data: { url: `/api/documents/${doc.id}` } });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "DOCUMENT_UPLOADED", entityType: "Document", entityId: doc.id } });
  return NextResponse.json({ document: doc }, { status: 201 });
}
