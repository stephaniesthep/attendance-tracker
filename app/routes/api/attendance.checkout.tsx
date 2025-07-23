import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { locationService } from "~/utils/location.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  
  const photo = formData.get("photo");
  const location = formData.get("location");
  const locationName = formData.get("locationName");

  if (typeof photo !== "string" || typeof location !== "string") {
    throw new Response("Invalid data", { status: 400 });
  }

  // Parse and validate location coordinates
  let coordinates;
  try {
    coordinates = JSON.parse(location);
    if (!coordinates.lat || !coordinates.lng) {
      throw new Error("Invalid coordinates");
    }
  } catch (error) {
    throw new Response("Invalid location data", { status: 400 });
  }

  // Get enhanced location information with quality scoring
  let locationResult;
  let finalLocationName = typeof locationName === "string" ? locationName : null;
  let locationSource = "client";
  let locationConfidence = "medium";
  let qualityScore = 50;
  let locationType = "unknown";

  try {
    // Use enhanced server-side location service for better accuracy
    locationResult = await locationService.getLocationName(coordinates.lat, coordinates.lng);
    finalLocationName = locationResult.name;
    locationSource = locationResult.source;
    locationConfidence = locationResult.confidence;
    qualityScore = locationResult.qualityScore;
    locationType = locationResult.locationType || "unknown";
    
    console.log(`Location resolved: ${finalLocationName} (Quality: ${qualityScore}, Source: ${locationSource})`);
  } catch (error) {
    console.error("Enhanced location lookup failed:", error);
    // Fall back to client-provided location name with lower quality score
    qualityScore = 30;
  }

  const today = new Date();
  
  // Find today's attendance record
  const attendance = await prisma.attendance.findFirst({
    where: {
      userId: user.id,
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
      checkOutTime: null,
    },
  });

  if (!attendance) {
    throw new Response("No check-in found for today", { status: 400 });
  }

  // Calculate duration
  const duration = differenceInMinutes(today, attendance.checkInTime);

  // Update attendance record with enhanced location data
  await (prisma.attendance as any).update({
    where: {
      id: attendance.id,
    },
    data: {
      checkOutTime: today,
      checkOutPhoto: photo,
      checkOutLocation: location,
      checkOutLocationName: finalLocationName,
      checkOutLocationSource: locationSource,
      checkOutLocationConfidence: locationConfidence,
      checkOutQualityScore: qualityScore,
      checkOutLocationType: locationType,
      checkOutLocationComponents: locationResult?.components ? JSON.stringify(locationResult.components) : null,
      checkOutGpsAccuracy: coordinates.accuracy || null,
      checkOutResponseTime: locationResult?.responseTime || null,
      duration,
    },
  });

  return redirect("/attendance");
}