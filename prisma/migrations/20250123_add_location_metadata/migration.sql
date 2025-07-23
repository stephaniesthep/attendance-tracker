-- Add location metadata fields
ALTER TABLE "Attendance" ADD COLUMN "checkInLocationSource" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "checkInLocationConfidence" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "checkOutLocationSource" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "checkOutLocationConfidence" TEXT;