import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

/** Streams the stored file. ?dl=1 forces download; otherwise opens inline (images / PDFs preview in the browser). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "documents", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await prisma.document.findUnique({ where: { id: params.id }, select: { fileName: true, mimeType: true, data: true } });
  if (!doc?.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inline = req.nextUrl.searchParams.get("dl") !== "1" && /^(image\/|application\/pdf)/.test(doc.mimeType);
  return new NextResponse(doc.data as any, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const doc = await prisma.document.findUnique({ where: { id: params.id }, select: { id: true, uploadedById: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Admins can delete anything; uploaders can remove their own files.
  if (!can(session.user.role, "documents", "delete") && doc.uploadedById !== session.user.id) {
    return NextResponse.json({ error: "You can only delete files you uploaded." }, { status: 403 });
  }
  await prisma.document.delete({ where: { id: doc.id } });
  await prisma.activityLog.create({ data: { userId: session.user.id, action: "DOCUMENT_DELETED", entityType: "Document", entityId: doc.id } });
  return NextResponse.json({ ok: true });
}
