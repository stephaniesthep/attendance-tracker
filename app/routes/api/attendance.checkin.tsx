import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { startOfDay, endOfDay } from "date-fns";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  
  const photo = formData.get("photo");
  const location = formData.get("location");
  const locationName = formData.get("locationName");

  if (typeof photo !== "string" || typeof location !== "string") {
    throw new Response("Invalid data", { status: 400 });
  }

  const today = new Date();
  
  // Check if already checked in today
  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      userId: user.id,
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
  });

  if (existingAttendance) {
    throw new Response("Already checked in today", { status: 400 });
  }

  // Create attendance record
  await (prisma.attendance as any).create({
    data: {
      userId: user.id,
      date: today,
      checkInTime: today,
      checkInPhoto: photo,
      checkInLocation: location,
      checkInLocationName: typeof locationName === "string" ? locationName : null,
    },
  });

  return redirect("/attendance");
}