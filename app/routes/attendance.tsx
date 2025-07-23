import { useState, useRef, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { startOfDay, endOfDay, format } from "date-fns";
import Webcam from "react-webcam";
import { Camera, MapPin, Clock, Download, AlertCircle, CheckCircle } from "lucide-react";
import {
  reverseGeocode,
  getCurrentLocation,
  isValidCoordinates,
  getDetailedLocation,
  assessLocationAccuracy,
  type Coordinates,
  type LocationOptions
} from "~/utils/location.client.enhanced";

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
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationConfidence, setLocationConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [locationQuality, setLocationQuality] = useState<number>(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      // Optimized location options for speed and high accuracy (<5m)
      const locationOptions: LocationOptions = {
        enableHighAccuracy: true,
        timeout: 8000, // Reduced timeout for faster response
        maximumAge: 10000, // Reduced cache age for fresher data
        progressiveAccuracy: true,
        retryAttempts: 2, // Fewer retries for speed
      };
      
      const coords = await getCurrentLocation(locationOptions);
      
      if (!isValidCoordinates(coords.lat, coords.lng)) {
        throw new Error("Invalid coordinates received");
      }
      
      // If GPS accuracy is poor (>5m), try to get a better reading
      if (coords.accuracy && coords.accuracy > 5) {
        console.log(`Initial GPS accuracy: ${coords.accuracy}m, attempting to improve...`);
        
        try {
          // Try one more time with stricter settings for better accuracy
          const betterCoords = await getCurrentLocation({
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0, // Force fresh reading
            progressiveAccuracy: false, // Single precise reading
          });
          
          // Use the better coordinates if they're more accurate
          if (betterCoords.accuracy && betterCoords.accuracy < coords.accuracy) {
            setLocation(betterCoords);
            console.log(`Improved GPS accuracy: ${betterCoords.accuracy}m`);
          } else {
            setLocation(coords);
          }
        } catch {
          // If second attempt fails, use original coordinates
          setLocation(coords);
        }
      } else {
        setLocation(coords);
      }
      
      // Get detailed location information with quality scoring (parallel to GPS improvement)
      const locationPromise = getDetailedLocation(coords.lat, coords.lng);
      const locationResult = await locationPromise;
      
      setLocationName(locationResult.name);
      setLocationConfidence(locationResult.confidence);
      setLocationQuality(locationResult.qualityScore);
      
      console.log(`Location acquired: ${locationResult.name}`);
      
    } catch (error) {
      console.error("Enhanced location error:", error);
      setLocationError(error instanceof Error ? error.message : "Unable to get location");
      setLocation(null);
      setLocationName(null);
      setLocationConfidence(null);
      setLocationQuality(0);
    } finally {
      setLocationLoading(false);
    }
  }, [location]);

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
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';

        // Add timestamp and action type
        const now = new Date();
        const dateStr = format(now, 'dd/MM/yyyy');
        const timeStr = format(now, 'HH:mm:ss');
        const actionType = !todayAttendance ? 'CHECK-IN' : 'CHECK-OUT';
        
        ctx.fillText(`Date: ${dateStr}`, 20, canvas.height - 100);
        ctx.fillText(`Time: ${timeStr}`, 20, canvas.height - 82);
        ctx.fillText(`Action: ${actionType}`, 20, canvas.height - 64);

        // Add location - prioritize enhanced location name
        const locationToShow = locationName || (location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Location unavailable');
        
        if (locationToShow) {
          ctx.font = 'bold 12px Arial';
          const maxWidth = canvas.width - 40;
          
          // Don't truncate - let it wrap naturally
          const words = locationToShow.split(' ');
          let line = '';
          let y = canvas.height - 46;
          
          ctx.fillText('Location:', 20, y);
          y += 14;
          
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
              ctx.fillText(line.trim(), 20, y);
              line = words[n] + ' ';
              y += 12;
              // Allow up to 3 lines for location to maximize space usage
              if (y > canvas.height - 4) break;
            } else {
              line = testLine;
            }
          }
          if (line.trim() && y <= canvas.height - 4) {
            ctx.fillText(line.trim(), 20, y);
          }
        }

        // Convert canvas to base64
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = imageSrc;
    });
  }, [locationName, location, locationConfidence, locationQuality, todayAttendance]);

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

  const startCapture = async () => {
    setShowCamera(true);
    setCapturedImage(null);
    await getLocation();
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
                    <div className="text-xs space-y-1">
                      <div>Date: {format(new Date(), 'dd/MM/yyyy')}</div>
                      <div>Time: {format(new Date(), 'HH:mm:ss')}</div>
                      <div>Action: {!todayAttendance ? 'CHECK-IN' : 'CHECK-OUT'}</div>
                      {locationName && (
                        <div className="text-xs">
                          Location: {locationName}
                        </div>
                      )}
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
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        {locationLoading ? "Getting location..." :
                         locationName ||
                         (location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` :
                          locationError || "Location unavailable")}
                      </span>
                      {locationError && (
                        <span className="text-xs text-red-500 mt-1">{locationError}</span>
                      )}
                    </div>
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
                    disabled={locationLoading}
                    className="mobile-button inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {locationLoading ? "Getting Location..." : "Open Camera"}
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