import { useState, useRef, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { format } from "date-fns";
import Webcam from "react-webcam";
import { Camera, MapPin, Clock, Download, AlertCircle, CheckCircle, Calendar } from "lucide-react";
import { Calendar as CalendarComponent } from "~/components/ui/calendar";
import {
  reverseGeocode,
  getCurrentLocation,
  isValidCoordinates,
  getDetailedLocation,
  assessLocationAccuracy,
  type Coordinates,
  type LocationOptions
} from "~/utils/location.client.enhanced";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireUser(request);
    const formData = await request.formData();
    const action = formData.get("action");

    if (action === "setOffDay") {
      const endDate = formData.get("endDate");
      
      if (typeof endDate !== "string") {
        return Response.json({ error: "Invalid end date" }, { status: 400 });
      }

      // Create off day record
      await prisma.offDay.create({
        data: {
          userId: user.id,
          startDate: new Date(),
          endDate: new Date(endDate + "T23:59:59"),
        },
      });

      return redirect("/attendance");
    }

    if (action === "updateOffDay") {
      const offDayId = formData.get("offDayId");
      const endDate = formData.get("endDate");
      
      if (typeof offDayId !== "string" || typeof endDate !== "string") {
        return Response.json({ error: "Invalid data" }, { status: 400 });
      }

      // Update off day record
      await prisma.offDay.update({
        where: { id: offDayId },
        data: { endDate: new Date(endDate + "T23:59:59") },
      });

      return redirect("/attendance");
    }

    if (action === "cancelOffDay") {
      const offDayId = formData.get("offDayId");
      
      if (typeof offDayId !== "string") {
        return Response.json({ error: "Invalid off day ID" }, { status: 400 });
      }

      // Delete off day record
      await prisma.offDay.delete({
        where: { id: offDayId },
      });

      return redirect("/attendance");
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Attendance action error:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireUser(request);
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const todayAttendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        date: today,
      },
    });

    // Check if user has an active off day
    const activeOffDay = await prisma.offDay.findFirst({
      where: {
        userId: user.id,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    return { user, todayAttendance, activeOffDay };
  } catch (error) {
    console.error("Attendance loader error:", error);
    throw new Response("Unable to load attendance page", { status: 500 });
  }
}

export default function Attendance() {
  const { user, todayAttendance, activeOffDay } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>('morning');
  const [showOffDayModal, setShowOffDayModal] = useState(false);
  const [offDayEndDate, setOffDayEndDate] = useState<string>('');
  const [selectedOffDayEndDate, setSelectedOffDayEndDate] = useState<Date | undefined>(undefined);
  const [showOffDayCalendar, setShowOffDayCalendar] = useState(false);
  const [showEditOffDayModal, setShowEditOffDayModal] = useState(false);
  const [editOffDayEndDate, setEditOffDayEndDate] = useState<Date | undefined>(undefined);
  const [showEditOffDayCalendar, setShowEditOffDayCalendar] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      // Simplified location options for better reliability
      const locationOptions: LocationOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        retryAttempts: 1,
        progressiveAccuracy: false,
      };
      
      const coords = await getCurrentLocation(locationOptions);
      
      if (!isValidCoordinates(coords.lat, coords.lng)) {
        throw new Error("Invalid coordinates received");
      }
      
      setLocation(coords);
      
      // Try to get location name, but don't fail if it doesn't work
      try {
        const locationResult = await getDetailedLocation(coords.lat, coords.lng);
        setLocationName(locationResult.name);
        setLocationConfidence(locationResult.confidence);
        setLocationQuality(locationResult.qualityScore);
        console.log(`Location acquired: ${locationResult.name}`);
      } catch (locationNameError) {
        console.warn("Could not get location name:", locationNameError);
        // Use coordinates as fallback
        setLocationName(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        setLocationConfidence('low');
        setLocationQuality(30);
      }
      
    } catch (error) {
      console.error("Location error:", error);
      setLocationError(error instanceof Error ? error.message : "Unable to get location");
      setLocation(null);
      setLocationName(null);
      setLocationConfidence(null);
      setLocationQuality(0);
    } finally {
      setLocationLoading(false);
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
    if (activeOffDay) {
      alert("You cannot check in while on off day.");
      return;
    }

    if (!capturedImage || !location) {
      alert("Please capture a photo and enable location services.");
      return;
    }

    // Clear any previous errors
    setSubmitError(null);
    setSubmitSuccess(null);

    fetcher.submit(
      {
        action: "checkin",
        photo: capturedImage,
        location: JSON.stringify(location),
        locationName: locationName || "",
        shift: selectedShift,
      },
      { method: "post", action: "/api/attendance/checkin" }
    );
  };

  const handleCheckOut = () => {
    if (activeOffDay) {
      alert("You cannot check out while on off day.");
      return;
    }

    if (!capturedImage || !location) {
      alert("Please capture a photo and enable location services.");
      return;
    }

    // Clear any previous errors
    setSubmitError(null);
    setSubmitSuccess(null);

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

  // Handle fetcher responses
  useEffect(() => {
    // Handle errors - when fetcher has an error or returns error data
    if (fetcher.state === "idle") {
      if (fetcher.data && typeof fetcher.data === 'object' && 'error' in fetcher.data) {
        // Handle structured error response
        setSubmitError(fetcher.data.error as string);
        // If the error is about already being checked in, revalidate to get current status
        if ((fetcher.data.error as string).includes('already checked in')) {
          revalidator.revalidate();
        }
      }
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  // Handle successful redirects (when fetcher completes and we're back on attendance page)
  useEffect(() => {
    // Check if we just completed a submission and are back on the attendance page
    if (fetcher.state === "idle" &&
        fetcher.data === null &&
        window.location.pathname === '/attendance' &&
        capturedImage &&
        !submitError &&
        !submitSuccess) {
      
      // We had a successful submission, show success message and revalidate
      const lastAction = fetcher.formData?.get('action');
      if (lastAction === 'checkin') {
        setSubmitSuccess("Successfully checked in!");
      } else if (lastAction === 'checkout') {
        setSubmitSuccess("Successfully checked out!");
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(null), 3000);
      
      // Revalidate the loader data to get updated attendance status
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, fetcher.formData, capturedImage, submitError, submitSuccess, revalidator]);

  // Handle fetcher errors (network errors, etc.)
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data === undefined) {
      // This might indicate a network error or server error
      const lastSubmission = fetcher.formData;
      if (lastSubmission && (submitError === null && submitSuccess === null)) {
        setSubmitError("Network error occurred. Please try again.");
      }
    }
  }, [fetcher.state, fetcher.data, submitError, submitSuccess]);

  // Clear errors when starting new capture
  const startCaptureWithErrorClear = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    await startCapture();
  };

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
                    {activeOffDay
                      ? `You are on off day until ${format(new Date(activeOffDay.endDate), 'dd/MM/yyyy')}`
                      : todayAttendance
                      ? todayAttendance.checkOut
                        ? "You have completed your attendance for today"
                        : "You are checked in"
                      : "You have not checked in yet"}
                  </p>
                  {todayAttendance?.shift && (
                    <p className="mt-1 text-xs text-gray-500">
                      Shift: {todayAttendance.shift.charAt(0).toUpperCase() + todayAttendance.shift.slice(1)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {format(new Date(), 'dd/MM/yyyy')}
                  </span>
                </div>
              </div>
            </div>

            {/* Error and Success Messages */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-700 mt-1">{submitError}</p>
                  </div>
                </div>
              </div>
            )}

            {submitSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                  <div>
                    <h3 className="text-sm font-medium text-green-800">Success</h3>
                    <p className="text-sm text-green-700 mt-1">{submitSuccess}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Off Day and Shift Selection */}
            {!activeOffDay && (
              <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Options</h3>
                </div>
                
                {/* Shift Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Shift
                  </label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="night">Night</option>
                  </select>
                </div>

                {/* Off Day Button */}
                <div>
                  <button
                    onClick={() => setShowOffDayModal(true)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    Set Off Day
                  </button>
                </div>
              </div>
            )}

            {/* Off Day Modal */}
            {showOffDayModal && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Set Off Day</h3>
                    <div className="space-y-4">
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Off day until when?
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowOffDayCalendar(!showOffDayCalendar)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          >
                            {selectedOffDayEndDate ? format(selectedOffDayEndDate, 'MMM dd, yyyy') : 'Select end date'}
                            <Calendar className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          </button>
                          {showOffDayCalendar && (
                            <div className="absolute z-10 mt-1">
                              <CalendarComponent
                                selected={selectedOffDayEndDate}
                                onSelect={(date) => {
                                  setSelectedOffDayEndDate(date);
                                  setOffDayEndDate(format(date, 'yyyy-MM-dd'));
                                  setShowOffDayCalendar(false);
                                }}
                                minDate={new Date()}
                                showClear={false}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            if (selectedOffDayEndDate) {
                              fetcher.submit(
                                {
                                  action: "setOffDay",
                                  endDate: format(selectedOffDayEndDate, 'yyyy-MM-dd'),
                                },
                                { method: "post" }
                              );
                              setShowOffDayModal(false);
                              setOffDayEndDate('');
                              setSelectedOffDayEndDate(undefined);
                              setShowOffDayCalendar(false);
                            }
                          }}
                          disabled={!selectedOffDayEndDate}
                          className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Set Off Day
                        </button>
                        <button
                          onClick={() => {
                            setShowOffDayModal(false);
                            setOffDayEndDate('');
                            setSelectedOffDayEndDate(undefined);
                            setShowOffDayCalendar(false);
                          }}
                          className="flex-1 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Off Day Modal */}
            {showEditOffDayModal && activeOffDay && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Off Day End Date</h3>
                    <div className="space-y-4">
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New end date
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowEditOffDayCalendar(!showEditOffDayCalendar)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          >
                            {editOffDayEndDate ? format(editOffDayEndDate, 'MMM dd, yyyy') : 'Select end date'}
                            <Calendar className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          </button>
                          {showEditOffDayCalendar && (
                            <div className="absolute z-10 mt-1">
                              <CalendarComponent
                                selected={editOffDayEndDate}
                                onSelect={(date) => {
                                  setEditOffDayEndDate(date);
                                  setShowEditOffDayCalendar(false);
                                }}
                                minDate={new Date()}
                                showClear={false}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            if (editOffDayEndDate) {
                              fetcher.submit(
                                {
                                  action: "updateOffDay",
                                  offDayId: activeOffDay.id,
                                  endDate: format(editOffDayEndDate, 'yyyy-MM-dd'),
                                },
                                { method: "post" }
                              );
                              setShowEditOffDayModal(false);
                              setEditOffDayEndDate(undefined);
                              setShowEditOffDayCalendar(false);
                            }
                          }}
                          disabled={!editOffDayEndDate}
                          className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Update End Date
                        </button>
                        <button
                          onClick={() => {
                            setShowEditOffDayModal(false);
                            setEditOffDayEndDate(undefined);
                            setShowEditOffDayCalendar(false);
                          }}
                          className="flex-1 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Off Day Management */}
            {activeOffDay && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-orange-800">Off Day Active</h3>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditOffDayEndDate(new Date(activeOffDay.endDate));
                        setShowEditOffDayModal(true);
                      }}
                      className="inline-flex items-center px-3 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      Edit End Date
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel your off day?")) {
                          fetcher.submit(
                            {
                              action: "cancelOffDay",
                              offDayId: activeOffDay.id,
                            },
                            { method: "post" }
                          );
                        }
                      }}
                      className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Cancel End Date
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                      onClick={startCaptureWithErrorClear}
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
                    onClick={startCaptureWithErrorClear}
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
                {todayAttendance && !todayAttendance.checkOut && (
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