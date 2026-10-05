import { pdfRoute } from "@/lib/pdfRoute";
import { workerReceiptPdf } from "@/lib/workerPdf";

export const GET = pdfRoute("workers", workerReceiptPdf);

// PDF rendering + a cold database can exceed the 10 s default on Vercel.
export const maxDuration = 60;
