import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "~/utils/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { attendanceId, type } = params;

  if (!attendanceId || !type) {
    throw new Response("Missing parameters", { status: 400 });
  }

  if (type !== "checkin" && type !== "checkout") {
    throw new Response("Invalid photo type", { status: 400 });
  }

  // Get the attendance record without authentication
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!attendance) {
    throw new Response("Attendance record not found", { status: 404 });
  }

  // Get the photo data - using correct field names from schema
  const photoData = type === "checkin" ? attendance.photoIn : attendance.photoOut;

  if (!photoData) {
    throw new Response("Photo not found", { status: 404 });
  }

  // Check if it's a base64 image
  if (photoData.startsWith("data:image/")) {
    // Extract the base64 data and mime type
    const [mimeInfo, base64Data] = photoData.split(",");
    const mimeType = mimeInfo.match(/data:([^;]+)/)?.[1] || "image/png";
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");
    
    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        "Access-Control-Allow-Origin": "*", // Allow cross-origin access for Excel
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Disposition": `inline; filename="${attendance.user.name}-${type}-${attendance.date}.${mimeType.split('/')[1]}"`,
      },
    });
  }

  // If it's not base64, assume it's a file path (for future file storage implementation)
  throw new Response("Unsupported photo format", { status: 400 });
}