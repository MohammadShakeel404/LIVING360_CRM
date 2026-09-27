import { pdfRoute } from "@/lib/pdfRoute";
import { projectLabourPdf } from "@/lib/workerPdf";

export const GET = pdfRoute("workers", projectLabourPdf);
