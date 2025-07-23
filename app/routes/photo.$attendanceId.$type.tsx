import { useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { format } from "date-fns";
import { ArrowLeft, User, MapPin, Clock, AlertCircle, Download } from "lucide-react";

type PhotoData = {
  id: string;
  type: "checkin" | "checkout";
  photoUrl: string;
  userName: string;
  userDivision: string;
  date: string;
  time: string;
  locationName: string | null;
  location: { lat: number; lng: number } | null;
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const { attendanceId, type } = params;

  if (!attendanceId || !type) {
    throw new Response("Missing parameters", { status: 400 });
  }

  if (type !== "checkin" && type !== "checkout") {
    throw new Response("Invalid photo type", { status: 400 });
  }

  // Get the attendance record
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          department: true,
          role: true,
        },
      },
    },
  });

  if (!attendance) {
    throw new Response("Attendance record not found", { status: 404 });
  }

  // Check permissions: users can only view their own photos, admins can view all
  if (user.role !== "ADMIN" && attendance.userId !== user.id) {
    throw new Response("Unauthorized", { status: 403 });
  }

  // Get the photo data
  const photoData = type === "checkin" ? attendance.checkInPhoto : attendance.checkOutPhoto;
  const timeData = type === "checkin" ? attendance.checkInTime : attendance.checkOutTime;
  const locationData = type === "checkin" ? attendance.checkInLocation : attendance.checkOutLocation;
  const locationNameData = type === "checkin" ? (attendance as any).checkInLocationName : (attendance as any).checkOutLocationName;

  if (!photoData || !timeData) {
    throw new Response("Photo not found", { status: 404 });
  }

  // Parse location data
  let location = null;
  try {
    if (locationData) {
      location = JSON.parse(locationData);
    }
  } catch {
    // Invalid location data
  }

  const photoInfo: PhotoData = {
    id: attendance.id,
    type: type as "checkin" | "checkout",
    photoUrl: `/api/photo/${attendanceId}/${type}`,
    userName: attendance.user.name,
    userDivision: attendance.user.department,
    date: format(new Date(attendance.date), "EEEE, MMMM d, yyyy"),
    time: format(new Date(timeData), "HH:mm:ss"),
    locationName: locationNameData,
    location,
  };

  return { photo: photoInfo };
}

export default function PhotoPreview() {
  const { photo } = useLoaderData<typeof loader>();
  const navigate = useNavigate();


  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.photoUrl;
    link.download = `${photo.userName}_${photo.type}_${photo.date.replace(/,/g, '')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBack = () => {
    // Navigate back to admin attendance page
    navigate("/admin/attendance");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {photo.type === "checkin" ? "Check-in" : "Check-out"} Photo
                </h1>
                <p className="text-sm text-gray-500">
                  {photo.userName} • {photo.date}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Photo Display */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="aspect-w-16 aspect-h-12 bg-gray-100">
                <img
                  src={photo.photoUrl}
                  alt={`${photo.type} photo`}
                  className="w-full h-full object-contain"
                  style={{ maxHeight: "70vh" }}
                />
              </div>
            </div>
          </div>

          {/* Photo Information */}
          <div className="space-y-6">
            {/* Employee Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Employee Information</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{photo.userName}</p>
                    <p className="text-sm text-gray-500">{photo.userDivision}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Time Information</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {photo.type === "checkin" ? "Check-in Time" : "Check-out Time"}
                    </p>
                    <p className="text-sm text-gray-500">{photo.time}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-500">Date: {photo.date}</p>
                </div>
              </div>
            </div>

            {/* Location Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Location Information</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    {photo.locationName ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">{photo.locationName}</p>
                        {photo.location && (
                          <p className="text-xs text-gray-500 mt-1">
                            Coordinates: {photo.location.lat.toFixed(6)}, {photo.location.lng.toFixed(6)}
                          </p>
                        )}
                        {/* Show confidence indicator if location name looks like fallback */}
                        {photo.locationName.includes("Location ") && photo.locationName.includes("°") && (
                          <p className="text-xs text-amber-600 mt-1 flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Low accuracy location
                          </p>
                        )}
                      </div>
                    ) : photo.location ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">Coordinates Only</p>
                        <p className="text-sm text-gray-500">
                          {photo.location.lat.toFixed(6)}, {photo.location.lng.toFixed(6)}
                        </p>
                        <p className="text-xs text-red-500 mt-1 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          No location name available
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-red-500 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Location not available
                        </p>
                      </div>
                    )}
                    
                    {photo.location && (
                      <a
                        href={`https://www.google.com/maps?q=${photo.location.lat},${photo.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center mt-2 text-xs text-indigo-600 hover:text-indigo-500"
                      >
                        View on Google Maps
                        <svg className="ml-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Photo Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={handleDownload}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Photo
                </button>
                <button
                  onClick={() => window.open(photo.photoUrl, '_blank')}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Open in New Tab
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}