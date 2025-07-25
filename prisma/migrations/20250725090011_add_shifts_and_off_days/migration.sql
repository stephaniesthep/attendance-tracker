-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "shift" TEXT;

-- CreateTable
CREATE TABLE "off_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT DEFAULT 'Off Day',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "off_days_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "off_days" ADD CONSTRAINT "off_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
