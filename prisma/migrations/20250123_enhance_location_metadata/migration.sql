-- Add enhanced location metadata fields
ALTER TABLE "Attendance" ADD COLUMN "checkInQualityScore" INTEGER;
ALTER TABLE "Attendance" ADD COLUMN "checkInLocationType" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "checkInLocationComponents" TEXT; -- JSON string with detailed address components
ALTER TABLE "Attendance" ADD COLUMN "checkInGpsAccuracy" REAL; -- GPS accuracy in meters
ALTER TABLE "Attendance" ADD COLUMN "checkInResponseTime" INTEGER; -- Provider response time in ms

ALTER TABLE "Attendance" ADD COLUMN "checkOutQualityScore" INTEGER;
ALTER TABLE "Attendance" ADD COLUMN "checkOutLocationType" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "checkOutLocationComponents" TEXT; -- JSON string with detailed address components
ALTER TABLE "Attendance" ADD COLUMN "checkOutGpsAccuracy" REAL; -- GPS accuracy in meters
ALTER TABLE "Attendance" ADD COLUMN "checkOutResponseTime" INTEGER; -- Provider response time in ms

-- Add indexes for better query performance
CREATE INDEX "idx_attendance_checkin_quality" ON "Attendance"("checkInQualityScore");
CREATE INDEX "idx_attendance_checkout_quality" ON "Attendance"("checkOutQualityScore");
CREATE INDEX "idx_attendance_location_type" ON "Attendance"("checkInLocationType", "checkOutLocationType");