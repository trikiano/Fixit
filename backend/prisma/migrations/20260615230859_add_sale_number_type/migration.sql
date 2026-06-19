-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "sale_number" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'vente';
