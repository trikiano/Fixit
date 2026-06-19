-- AlterTable
ALTER TABLE "CardTopup" ADD COLUMN     "card_name" TEXT,
ADD COLUMN     "date" TEXT;

-- AlterTable
ALTER TABLE "CashRegister" ADD COLUMN     "difference_reason" TEXT,
ADD COLUMN     "total_card_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_cash_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_expenses" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyalty_points" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InternetPackage" ADD COLUMN     "cost_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "data_amount" TEXT,
ADD COLUMN     "sell_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "validity_days" INTEGER;

-- AlterTable
ALTER TABLE "InternetSale" ADD COLUMN     "account_used" TEXT,
ADD COLUMN     "activation_code" TEXT,
ADD COLUMN     "cost_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "data_amount" TEXT,
ADD COLUMN     "sell_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "validity_days" INTEGER;

-- AlterTable
ALTER TABLE "PrepaidCard" ADD COLUMN     "card_number" TEXT,
ADD COLUMN     "currency" TEXT DEFAULT 'DZD',
ADD COLUMN     "current_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "total_loaded" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "code" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Promotion" DROP COLUMN "min_amount",
DROP COLUMN "uses_count",
ADD COLUMN     "applicable_to" TEXT NOT NULL DEFAULT 'tous',
ADD COLUMN     "current_uses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "min_purchase" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "discount_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "payments" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ServiceItem" ADD COLUMN     "category_name" TEXT,
ADD COLUMN     "cost_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sell_price" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ServiceSale" ADD COLUMN     "activation_code" TEXT,
ADD COLUMN     "card_name" TEXT,
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "category_name" TEXT,
ADD COLUMN     "cost_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sell_price" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SupplierInvoice" ADD COLUMN     "due_date" TEXT;

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "account_name" TEXT,
ADD COLUMN     "amount_given" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sales_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_sales_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
