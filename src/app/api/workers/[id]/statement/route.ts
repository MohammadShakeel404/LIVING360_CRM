import { pdfRoute } from "@/lib/pdfRoute";
import { workerStatementPdf } from "@/lib/workerPdf";

export const GET = pdfRoute("workers", workerStatementPdf);
