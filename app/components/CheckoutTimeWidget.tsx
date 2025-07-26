import { Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface CheckoutTimeWidgetProps {
  todayAttendance?: {
    checkIn?: string | null;
    checkOut?: string | null;
    status?: string;
  } | null;
  className?: string;
}

export function CheckoutTimeWidget({
  todayAttendance,
  className = ""
}: CheckoutTimeWidgetProps) {
  const hasCheckedIn = todayAttendance?.checkIn;
  const hasCheckedOut = todayAttendance?.checkOut;
  const isCompleted = hasCheckedIn && hasCheckedOut;

  return (
    <div className={`bg-white overflow-hidden shadow rounded-lg ${className}`}>
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {isCompleted ? (
              <CheckCircle className="h-6 w-6 text-green-400" />
            ) : hasCheckedIn ? (
              <Clock className="h-6 w-6 text-yellow-400" />
            ) : (
              <XCircle className="h-6 w-6 text-red-400" />
            )}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                Checkout Time
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {hasCheckedOut
                  ? format(new Date(hasCheckedOut), "h:mm a")
                  : "-"}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}