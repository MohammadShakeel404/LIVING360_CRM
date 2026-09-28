import { pdfRoute } from "@/lib/pdfRoute";
import { workerReceiptPdf } from "@/lib/workerPdf";

export const GET = pdfRoute("workers", workerReceiptPdf);
