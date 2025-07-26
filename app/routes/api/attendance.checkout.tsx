import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { differenceInMinutes, format } from "date-fns";
import { locationService } from "~/utils/location.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireUser(request);
    const formData = await request.formData();
    
    const photo = formData.get("photo");
    const location = formData.get("location");
    const locationName = formData.get("locationName");

    if (typeof photo !== "string" || typeof location !== "string") {
      return Response.json({ error: "Invalid data provided" }, { status: 400 });
    }

    // Parse and validate location coordinates
    let coordinates;
    try {
      coordinates = JSON.parse(location);
      if (!coordinates.lat || !coordinates.lng) {
        throw new Error("Invalid coordinates");
      }
    } catch (error) {
      return Response.json({ error: "Invalid location data" }, { status: 400 });
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
  const todayString = format(today, 'yyyy-MM-dd'); // Use same format as loader
  
  // Find today's attendance record
  const attendance = await prisma.attendance.findFirst({
    where: {
      userId: user.id,
      date: todayString,
      checkOut: null,
    },
  });

    if (!attendance) {
      return Response.json({ error: "No check-in found for today. Please check in first." }, { status: 400 });
    }

    // Calculate duration if checkIn exists
    let duration = 0;
    if (attendance.checkIn) {
      duration = differenceInMinutes(today, attendance.checkIn);
    }

    // Update attendance record using correct field names from schema
    await prisma.attendance.update({
      where: {
        id: attendance.id,
      },
      data: {
        checkOut: today,
        photoOut: photo,
        locationOut: location,
      },
    });

    return Response.json({
      success: true,
      message: "Check-out Successful"
    }, { status: 200 });
  } catch (error) {
    console.error("Check-out error:", error);
    // For any other error, return a JSON error response
    return Response.json({ error: "An unexpected error occurred during check-out. Please try again." }, { status: 500 });
  }
}