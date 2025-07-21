import { useState, useRef, useCallback } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { startOfDay, endOfDay } from "date-fns";
import Webcam from "react-webcam";
import { Camera, MapPin, Clock } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const today = new Date();
  
  const todayAttendance = await prisma.attendance.findFirst({
    where: {
      userId: user.id,
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
  });

  return { user, todayAttendance };
}

export default function Attendance() {
  const { user, todayAttendance } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const webcamRef = useRef<Webcam>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const getLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          setLocationError("Unable to get location. Please enable location services.");
        }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
    }
  }, []);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setShowCamera(false);
    }
  }, [webcamRef]);

  const handleCheckIn = () => {
    if (!capturedImage || !location) {
      alert("Please capture a photo and enable location services.");
      return;
    }

    fetcher.submit(
      {
        action: "checkin",
        photo: capturedImage,
        location: JSON.stringify(location),
      },
      { method: "post", action: "/api/attendance/checkin" }
    );
  };

  const handleCheckOut = () => {
    if (!capturedImage || !location) {
      alert("Please capture a photo and enable location services.");
      return;
    }

    fetcher.submit(
      {
        action: "checkout",
        photo: capturedImage,
        location: JSON.stringify(location),
      },
      { method: "post", action: "/api/attendance/checkout" }
    );
  };

  const startCapture = () => {
    setShowCamera(true);
    setCapturedImage(null);
    getLocation();
  };

  const isSubmitting = fetcher.state === "submitting";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-600">
          Check in and out with your photo and location
        </p>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="space-y-6">
            {/* Status Display */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Current Status</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {todayAttendance
                      ? todayAttendance.checkOutTime
                        ? "You have completed your attendance for today"
                        : "You are checked in"
                      : "You have not checked in yet"}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Camera Section */}
            {showCamera ? (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <Webcam
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full"
                    videoConstraints={{
                      width: 1280,
                      height: 720,
                      facingMode: "user",
                    }}
                  />
                </div>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={capture}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Photo
                  </button>
                  <button
                    onClick={() => setShowCamera(false)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden">
                  <img src={capturedImage} alt="Captured" className="w-full" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {location
                        ? `Location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                        : locationError || "Getting location..."}
                    </span>
                  </div>
                  <button
                    onClick={startCapture}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Retake Photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Camera className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No photo captured</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Take a photo to check in or out
                </p>
                <div className="mt-6">
                  <button
                    onClick={startCapture}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Open Camera
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {capturedImage && location && (
              <div className="flex justify-center space-x-4">
                {!todayAttendance && (
                  <button
                    onClick={handleCheckIn}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Checking In..." : "Check In"}
                  </button>
                )}
                {todayAttendance && !todayAttendance.checkOutTime && (
                  <button
                    onClick={handleCheckOut}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Checking Out..." : "Check Out"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}