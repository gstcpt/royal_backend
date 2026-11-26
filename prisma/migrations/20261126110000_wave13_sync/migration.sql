-- Safe, additive, idempotent Wave 13 sync migration (zero data loss)

-- CreateEnum (Idempotent)
DO $$ BEGIN
  CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'DISLIKE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (Idempotent)
DO $$ BEGIN
  CREATE TYPE "DeliveryCalculationMethod" AS ENUM ('DISTANCE', 'WEIGHT', 'FIXED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (Idempotent)
DO $$ BEGIN
  CREATE TYPE "SupportThreadStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRANSFER_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRANSFER_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRANSFER_COMPLETED';

-- AlterTable
ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "actorName" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "diffJson" JSONB,
ADD COLUMN IF NOT EXISTS "tableName" TEXT;

-- AlterTable
ALTER TABLE "brands"
ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "categories"
ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "showinmenu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "coupons"
ADD COLUMN IF NOT EXISTS "minQuantity" INTEGER,
ADD COLUMN IF NOT EXISTS "targetIds" JSONB,
ADD COLUMN IF NOT EXISTS "targetType" TEXT NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "delivery_companies"
ADD COLUMN IF NOT EXISTS "defaultMethod" "DeliveryCalculationMethod" NOT NULL DEFAULT 'FIXED',
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "estimatedDays" TEXT NOT NULL DEFAULT '24h - 48h',
ADD COLUMN IF NOT EXISTS "fixedPrice" DECIMAL(14,4) NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "originCity" TEXT,
ADD COLUMN IF NOT EXISTS "originCountry" TEXT NOT NULL DEFAULT 'TN',
ADD COLUMN IF NOT EXISTS "originState" TEXT NOT NULL DEFAULT 'Tunis',
ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable
ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'CUSTOMER',
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryCompanyId" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryDistanceKm" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "deliveryMethodType" "DeliveryCalculationMethod",
ADD COLUMN IF NOT EXISTS "deliveryTotalWeightKg" DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS "fulfillmentType" TEXT NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "pickupShowroomId" TEXT,
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "product_likes"
ADD COLUMN IF NOT EXISTS "reaction" "ReactionType" NOT NULL DEFAULT 'LIKE',
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "product_variants"
ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "dislikeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "stock_transfers"
ADD COLUMN IF NOT EXISTS "acceptanceMode" TEXT,
ADD COLUMN IF NOT EXISTS "orderId" TEXT,
ADD COLUMN IF NOT EXISTS "requestRef" TEXT,
ADD COLUMN IF NOT EXISTS "requestType" TEXT NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN IF NOT EXISTS "showroomId" TEXT;

-- AlterTable
ALTER TABLE "suppliers"
ADD COLUMN IF NOT EXISTS "cin" TEXT,
ADD COLUMN IF NOT EXISTS "contactPerson" TEXT,
ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS "supplierType" TEXT NOT NULL DEFAULT 'COMPANY',
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "warehouses"
ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "permissions_views" (
    "id" TEXT NOT NULL,
    "permissionId" TEXT,
    "permissionCode" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionTitleFr" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionOrder" INTEGER NOT NULL DEFAULT 13,
    "sectionLabelFr" TEXT NOT NULL,
    "viewPath" TEXT NOT NULL,
    "viewLabelFr" TEXT NOT NULL,
    "backendRoute" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'SCANNER',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "characteristics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "unit" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "iconUrl" TEXT,
    "optionsJson" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT DEFAULT 'SYSTEM',
    "updatedBy" TEXT,
    "isUpdated" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "category_characteristics" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "variant_families" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "visualType" TEXT NOT NULL DEFAULT 'TEXT_PILL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT DEFAULT 'SYSTEM',
    "updatedBy" TEXT,
    "isUpdated" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "variant_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "variant_options" (
    "id" TEXT NOT NULL,
    "variantFamilyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "code" TEXT,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT DEFAULT 'SYSTEM',
    "updatedBy" TEXT,
    "isUpdated" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "variant_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_company_methods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "method" "DeliveryCalculationMethod" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "fixedPrice" DECIMAL(14,4),
    "bracketsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_company_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "faq_items" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Général',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cms_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contact_submissions" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "replyContent" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'homepage',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_threads" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportThreadStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL DEFAULT 'CLIENT',
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isReadByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isReadByClient" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "permissions_views_sectionOrder_sectionKey_idx" ON "permissions_views"("sectionOrder", "sectionKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "permissions_views_viewPath_idx" ON "permissions_views"("viewPath");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "permissions_views_module_idx" ON "permissions_views"("module");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_views_permissionCode_viewPath_key" ON "permissions_views"("permissionCode", "viewPath");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "characteristics_code_key" ON "characteristics"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "characteristics_code_idx" ON "characteristics"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "characteristics_deletedAt_idx" ON "characteristics"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "category_characteristics_categoryId_characteristicId_key" ON "category_characteristics"("categoryId", "characteristicId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "variant_families_code_key" ON "variant_families"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "variant_families_code_idx" ON "variant_families"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "variant_families_deletedAt_idx" ON "variant_families"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "variant_options_variantFamilyId_idx" ON "variant_options"("variantFamilyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "variant_options_deletedAt_idx" ON "variant_options"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_company_methods_companyId_idx" ON "delivery_company_methods"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_company_methods_companyId_method_key" ON "delivery_company_methods"("companyId", "method");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "faq_items_isActive_sortOrder_idx" ON "faq_items"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_submissions_status_createdAt_idx" ON "contact_submissions"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "newsletter_subscribers_isActive_createdAt_idx" ON "newsletter_subscribers"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_threads_customerId_updatedAt_idx" ON "support_threads"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_messages_threadId_createdAt_idx" ON "support_messages"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "brands_deletedAt_idx" ON "brands"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "categories_deletedAt_idx" ON "categories"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_deliveryCompanyId_idx" ON "orders"("deliveryCompanyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_pickupShowroomId_idx" ON "orders"("pickupShowroomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_transfers_orderId_idx" ON "stock_transfers"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_transfers_showroomId_idx" ON "stock_transfers"("showroomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_transfers_status_idx" ON "stock_transfers"("status");

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "permissions_views" ADD CONSTRAINT "permissions_views_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "category_characteristics" ADD CONSTRAINT "category_characteristics_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "category_characteristics" ADD CONSTRAINT "category_characteristics_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "characteristics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_variantFamilyId_fkey" FOREIGN KEY ("variantFamilyId") REFERENCES "variant_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_showroomId_fkey" FOREIGN KEY ("showroomId") REFERENCES "points_of_sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_deliveryCompanyId_fkey" FOREIGN KEY ("deliveryCompanyId") REFERENCES "delivery_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_pickupShowroomId_fkey" FOREIGN KEY ("pickupShowroomId") REFERENCES "points_of_sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "delivery_company_methods" ADD CONSTRAINT "delivery_company_methods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "delivery_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "support_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
