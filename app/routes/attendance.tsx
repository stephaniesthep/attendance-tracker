import { useState, useRef, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { startOfDay, endOfDay, format } from "date-fns";
import Webcam from "react-webcam";
import { Camera, MapPin, Clock, Download } from "lucide-react";

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
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      // Using OpenStreetMap Nominatim API for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        // Extract meaningful location parts
        const address = data.address || {};
        const locationParts = [
          address.house_number,
          address.road,
          address.neighbourhood || address.suburb,
          address.city || address.town || address.village,
          address.state,
          address.country
        ].filter(Boolean);
        
        return locationParts.slice(0, 3).join(", ") || data.display_name;
      }
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const getLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(coords);
          setLocationError(null);
          
          // Get location name
          const name = await reverseGeocode(coords.lat, coords.lng);
          setLocationName(name);
        },
        (error) => {
          setLocationError("Unable to get location. Please enable location services.");
        }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
    }
  }, []);

  const addOverlayToImage = useCallback((imageSrc: string) => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          resolve(imageSrc);
          return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        // Flip the image horizontally
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(img, -img.width, 0);
        ctx.restore();

        // Add overlay background
        const overlayHeight = 140;
        const gradient = ctx.createLinearGradient(0, canvas.height - overlayHeight, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight);

        // Set text properties
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';

        // Add timestamp and action type
        const now = new Date();
        const dateStr = format(now, 'dd/MM/yyyy');
        const timeStr = format(now, 'HH:mm:ss');
        const actionType = !todayAttendance ? 'CHECK-IN' : 'CHECK-OUT';
        
        ctx.fillText(`Date: ${dateStr}`, 20, canvas.height - 110);
        ctx.fillText(`Time: ${timeStr}`, 20, canvas.height - 85);
        ctx.fillText(`Action: ${actionType}`, 20, canvas.height - 60);

        // Add location
        if (locationName) {
          ctx.font = 'bold 16px Arial';
          // Wrap long location names
          const maxWidth = canvas.width - 40;
          const words = locationName.split(' ');
          let line = '';
          let y = canvas.height - 35;
          
          ctx.fillText('Location:', 20, y);
          y += 20;
          
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
              ctx.fillText(line, 20, y);
              line = words[n] + ' ';
              y += 20;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, 20, y);
        }

        // Convert canvas to base64
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = imageSrc;
    });
  }, [locationName, todayAttendance]);

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      const imageWithOverlay = await addOverlayToImage(imageSrc);
      setCapturedImage(imageWithOverlay);
      setShowCamera(false);
    }
  }, [webcamRef, addOverlayToImage]);

  const downloadImage = useCallback(() => {
    if (!capturedImage) return;
    
    const link = document.createElement('a');
    link.download = `attendance-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.jpg`;
    link.href = capturedImage;
    link.click();
  }, [capturedImage]);

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
        locationName: locationName || "",
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
        locationName: locationName || "",
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
                <div className="camera-container rounded-lg overflow-hidden bg-black">
                  <Webcam
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="transform scale-x-[-1]"
                    videoConstraints={{
                      width: { ideal: 720 },
                      height: { ideal: 1280 },
                      facingMode: "user",
                      aspectRatio: 9/16
                    }}
                  />
                  {/* Live overlay preview */}
                  <div className="camera-overlay">
                    <div className="text-sm space-y-1">
                      <div>Date: {format(new Date(), 'dd/MM/yyyy')}</div>
                      <div>Time: {format(new Date(), 'HH:mm:ss')}</div>
                      <div>Action: {!todayAttendance ? 'CHECK-IN' : 'CHECK-OUT'}</div>
                      {locationName && <div className="text-xs">Location: {locationName}</div>}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={capture}
                    className="mobile-button inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Photo
                  </button>
                  <button
                    onClick={() => setShowCamera(false)}
                    className="mobile-button inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="space-y-4">
                <div className="image-container rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {locationName || (location
                        ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                        : locationError || "Getting location...")}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={downloadImage}
                      className="download-button mobile-button inline-flex items-center text-sm text-green-600 hover:text-green-500 px-3 py-2 rounded-md border border-green-200 hover:bg-green-50"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </button>
                    <button
                      onClick={startCapture}
                      className="mobile-button text-sm text-indigo-600 hover:text-indigo-500 px-3 py-2 rounded-md border border-indigo-200 hover:bg-indigo-50"
                    >
                      Retake Photo
                    </button>
                  </div>
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
                    className="mobile-button inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                    className="mobile-button inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Checking In..." : "Check In"}
                  </button>
                )}
                {todayAttendance && !todayAttendance.checkOutTime && (
                  <button
                    onClick={handleCheckOut}
                    disabled={isSubmitting}
                    className="mobile-button inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Checking Out..." : "Check Out"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}