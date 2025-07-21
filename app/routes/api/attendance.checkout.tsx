import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { startOfDay, endOfDay, differenceInMinutes } from "date-fns";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  
  const photo = formData.get("photo");
  const location = formData.get("location");

  if (typeof photo !== "string" || typeof location !== "string") {
    throw new Response("Invalid data", { status: 400 });
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

  // Update attendance record
  await prisma.attendance.update({
    where: {
      id: attendance.id,
    },
    data: {
      checkOutTime: today,
      checkOutPhoto: photo,
      checkOutLocation: location,
      duration,
    },
  });

  return redirect("/attendance");
}