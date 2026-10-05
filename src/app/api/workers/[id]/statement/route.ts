import { pdfRoute } from "@/lib/pdfRoute";
import { workerStatementPdf } from "@/lib/workerPdf";

export const GET = pdfRoute("workers", workerStatementPdf);

// PDF rendering + a cold database can exceed the 10 s default on Vercel.
export const maxDuration = 60;
