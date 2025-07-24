import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { format } from "date-fns";

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

    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd'); // Use same format as loader
    
    // Check if already checked in today
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        date: todayString,
      },
    });

    if (existingAttendance) {
      return Response.json({ error: "You have already checked in today" }, { status: 400 });
    }

    // Create attendance record using correct field names from schema
    await prisma.attendance.create({
      data: {
        userId: user.id,
        date: todayString,
        checkIn: today,
        photoIn: photo,
        locationIn: location,
        status: "present",
      },
    });

    return redirect("/attendance");
  } catch (error) {
    console.error("Check-in error:", error);
    // For any other error, return a JSON error response
    return Response.json({ error: "An unexpected error occurred during check-in. Please try again." }, { status: 500 });
  }
}