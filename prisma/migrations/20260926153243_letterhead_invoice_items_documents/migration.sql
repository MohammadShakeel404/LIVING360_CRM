-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "address" TEXT,
ADD COLUMN     "gstin" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "data" BYTEA,
ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN     "size" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "url" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSac" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "gstPct" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'Living 360',
    "tagline" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "logo" TEXT,
    "headerImage" TEXT,
    "footerImage" TEXT,
    "footerText" TEXT,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "ifsc" TEXT,
    "branch" TEXT,
    "upiId" TEXT,
    "signatoryName" TEXT,
    "signatoryTitle" TEXT,
    "signature" TEXT,
    "quotationTerms" TEXT,
    "invoiceTerms" TEXT,
    "quotationValidityDays" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
