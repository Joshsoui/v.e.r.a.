-- AlterTable
ALTER TABLE "format_templates" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "format_templates_organizationId_idx" ON "format_templates"("organizationId");

-- AddForeignKey
ALTER TABLE "format_templates" ADD CONSTRAINT "format_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
