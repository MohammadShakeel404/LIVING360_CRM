import { pdfRoute } from "@/lib/pdfRoute";
import { projectLabourPdf } from "@/lib/workerPdf";

export const GET = pdfRoute("workers", projectLabourPdf);

// PDF rendering + a cold database can exceed the 10 s default on Vercel.
export const maxDuration = 60;
