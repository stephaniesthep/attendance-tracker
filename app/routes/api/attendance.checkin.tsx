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
    const shift = formData.get("shift");

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
    
    // Check if user is on an off day
    const currentOffDay = await prisma.offDay.findFirst({
      where: {
        userId: user.id,
        startDate: {
          lte: today,
        },
        endDate: {
          gte: today,
        },
      },
    });

    if (currentOffDay) {
      return Response.json({
        error: `You cannot check in during your off day period (${format(currentOffDay.startDate, 'MMM dd, yyyy')} - ${format(currentOffDay.endDate, 'MMM dd, yyyy')})${currentOffDay.reason ? ` - ${currentOffDay.reason}` : ''}`
      }, { status: 400 });
    }
    
    // Check if already checked in today (only prevent if there's an active check-in without check-out)
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        date: todayString,
        checkOut: null, // Only check for records that haven't been checked out
      },
      orderBy: {
        checkIn: 'desc', // Get the most recent check-in
      },
    });

    if (activeAttendance) {
      return Response.json({ error: "You are already checked in. Please check out first before checking in again." }, { status: 400 });
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
        shift: typeof shift === "string" ? shift : "morning",
      },
    });

    return Response.json({
      success: true,
      message: "Check-in Successful"
    }, { status: 200 });
  } catch (error) {
    console.error("Check-in error:", error);
    // For any other error, return a JSON error response
    return Response.json({ error: "An unexpected error occurred during check-in. Please try again." }, { status: 500 });
  }
}