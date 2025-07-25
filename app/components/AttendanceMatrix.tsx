import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Calendar, Clock, Moon, Sun, Sunset, X, Download } from "lucide-react";
import type { DateRange } from "~/components/ui/calendar";

// Define attendance status types and their colors
export const ATTENDANCE_STATUS = {
  OFF_DAY: 'off_day',
  MORNING_SHIFT: 'morning',
  AFTERNOON_SHIFT: 'afternoon',
  NIGHT_SHIFT: 'night',
  ABSENT: 'absent',
  PRESENT: 'present'
} as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

// Color mapping for different statuses
export const STATUS_COLORS = {
  [ATTENDANCE_STATUS.OFF_DAY]: 'bg-red-200 text-red-800 border-red-300',
  [ATTENDANCE_STATUS.MORNING_SHIFT]: 'bg-yellow-400 text-yellow-900 border-yellow-500',
  [ATTENDANCE_STATUS.AFTERNOON_SHIFT]: 'bg-orange-400 text-orange-900 border-orange-500',
  [ATTENDANCE_STATUS.NIGHT_SHIFT]: 'bg-blue-600 text-white border-blue-700',
  [ATTENDANCE_STATUS.ABSENT]: 'bg-gray-200 text-gray-600 border-gray-300',
  [ATTENDANCE_STATUS.PRESENT]: 'bg-green-400 text-green-900 border-green-500'
} as const;

// Icons for different statuses
export const STATUS_ICONS = {
  [ATTENDANCE_STATUS.OFF_DAY]: X,
  [ATTENDANCE_STATUS.MORNING_SHIFT]: Sun,
  [ATTENDANCE_STATUS.AFTERNOON_SHIFT]: Sunset,
  [ATTENDANCE_STATUS.NIGHT_SHIFT]: Moon,
  [ATTENDANCE_STATUS.ABSENT]: X,
  [ATTENDANCE_STATUS.PRESENT]: Clock
} as const;

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn?: Date | null;
  checkOut?: Date | null;
  shift?: string | null;
  status: string;
}

export interface OffDayRecord {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
}

export interface UserAttendanceData {
  user: {
    id: string;
    name: string;
    department?: string | null;
  };
  attendances: AttendanceRecord[];
  offDays: OffDayRecord[];
}

interface AttendanceMatrixProps {
  data: UserAttendanceData[];
  viewType: 'daily' | 'weekly' | 'monthly' | 'range';
  selectedDate: Date;
  selectedRange?: DateRange;
  showUserNames?: boolean;
  canExport?: boolean;
  userRole?: 'worker' | 'admin' | 'superadmin';
  onExport?: () => void;
}

// Utility function to determine attendance status for a specific date
export function getAttendanceStatus(
  date: Date,
  attendances: AttendanceRecord[],
  offDays: OffDayRecord[]
): AttendanceStatus {
  const dateString = format(date, 'yyyy-MM-dd');
  
  // Check if it's an off day
  const isOffDay = offDays.some(offDay => {
    const startDate = new Date(offDay.startDate);
    const endDate = new Date(offDay.endDate);
    return date >= startDate && date <= endDate;
  });
  
  if (isOffDay) {
    return ATTENDANCE_STATUS.OFF_DAY;
  }
  
  // Find attendance record for this date
  const attendance = attendances.find(att => att.date === dateString);
  
  if (!attendance) {
    return ATTENDANCE_STATUS.ABSENT;
  }
  
  // If there's an attendance record but no check-in, treat as absent
  if (!attendance.checkIn) {
    return ATTENDANCE_STATUS.ABSENT;
  }
  
  // Determine shift based on attendance shift field or check-in time
  if (attendance.shift) {
    switch (attendance.shift.toLowerCase()) {
      case 'morning':
        return ATTENDANCE_STATUS.MORNING_SHIFT;
      case 'afternoon':
        return ATTENDANCE_STATUS.AFTERNOON_SHIFT;
      case 'night':
        return ATTENDANCE_STATUS.NIGHT_SHIFT;
      default:
        return ATTENDANCE_STATUS.PRESENT;
    }
  }
  
  // If no shift specified, determine by check-in time
  if (attendance.checkIn) {
    const checkInHour = new Date(attendance.checkIn).getHours();
    if (checkInHour >= 6 && checkInHour < 14) {
      return ATTENDANCE_STATUS.MORNING_SHIFT;
    } else if (checkInHour >= 14 && checkInHour < 22) {
      return ATTENDANCE_STATUS.AFTERNOON_SHIFT;
    } else {
      return ATTENDANCE_STATUS.NIGHT_SHIFT;
    }
  }
  
  return ATTENDANCE_STATUS.PRESENT;
}

// Generate date range based on view type
function getDateRange(selectedDate: Date, viewType: 'daily' | 'weekly' | 'monthly' | 'range', selectedRange?: DateRange): Date[] {
  switch (viewType) {
    case 'daily':
      return [selectedDate];
    case 'weekly':
      // Use custom range if available, otherwise traditional week
      if (selectedRange?.from && selectedRange?.to) {
        return eachDayOfInterval({
          start: selectedRange.from,
          end: selectedRange.to
        });
      } else {
        // Fallback to traditional week (Monday start)
        return eachDayOfInterval({
          start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
          end: endOfWeek(selectedDate, { weekStartsOn: 1 })
        });
      }
    case 'monthly':
      // Use custom range if available, otherwise traditional month
      if (selectedRange?.from && selectedRange?.to) {
        return eachDayOfInterval({
          start: selectedRange.from,
          end: selectedRange.to
        });
      } else {
        // Fallback to traditional month
        return eachDayOfInterval({
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate)
        });
      }
    case 'range':
      if (selectedRange?.from && selectedRange?.to) {
        return eachDayOfInterval({
          start: selectedRange.from,
          end: selectedRange.to
        });
      } else if (selectedRange?.from) {
        return [selectedRange.from];
      } else {
        return [selectedDate];
      }
    default:
      return [selectedDate];
  }
}

export function AttendanceMatrix({
  data,
  viewType,
  selectedDate,
  selectedRange,
  showUserNames = true,
  canExport = false,
  userRole = 'worker',
  onExport
}: AttendanceMatrixProps) {
  const dateRange = getDateRange(selectedDate, viewType, selectedRange);
  
  const handleExport = async () => {
    if (onExport) {
      onExport();
      return;
    }

    // Default export functionality if no custom handler provided
    try {
      const { exportAttendanceMatrixToExcel } = await import("~/utils/attendance-matrix-excel");
      
      await exportAttendanceMatrixToExcel({
        data,
        selectedDate,
        viewType: viewType as any,
        userRole,
        showUserNames,
        worksheetName: `Attendance Matrix - ${viewType.charAt(0).toUpperCase() + viewType.slice(1)}`
      });
    } catch (error) {
      console.error("Error exporting attendance matrix:", error);
      alert("Error generating Excel file. Please try again.");
    }
  };
  
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Attendance Matrix - {viewType.charAt(0).toUpperCase() + viewType.slice(1)} View
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              {format(selectedDate, 'MMMM yyyy')} - Color coded attendance tracking
            </p>
          </div>
          {canExport && (
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </button>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded border mr-2 ${STATUS_COLORS[ATTENDANCE_STATUS.MORNING_SHIFT]}`}></div>
            <span>Morning Shift</span>
          </div>
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded border mr-2 ${STATUS_COLORS[ATTENDANCE_STATUS.AFTERNOON_SHIFT]}`}></div>
            <span>Afternoon Shift</span>
          </div>
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded border mr-2 ${STATUS_COLORS[ATTENDANCE_STATUS.NIGHT_SHIFT]}`}></div>
            <span>Night Shift</span>
          </div>
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded border mr-2 ${STATUS_COLORS[ATTENDANCE_STATUS.OFF_DAY]}`}></div>
            <span>Off Day</span>
          </div>
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded border mr-2 ${STATUS_COLORS[ATTENDANCE_STATUS.ABSENT]}`}></div>
            <span>Absent</span>
          </div>
        </div>
      </div>
      
      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {showUserNames && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                  Employee
                </th>
              )}
              {dateRange.map((date) => (
                <th key={date.toISOString()} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]">
                  <div className="flex flex-col items-center">
                    <span>{format(date, 'EEE')}</span>
                    <span className="font-bold">{format(date, 'd')}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((userData) => (
              <tr key={userData.user.id} className="hover:bg-gray-50">
                {showUserNames && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">
                    <div>
                      <div className="font-medium">{userData.user.name}</div>
                      {userData.user.department && (
                        <div className="text-xs text-gray-500">{userData.user.department}</div>
                      )}
                    </div>
                  </td>
                )}
                {dateRange.map((date) => {
                  const status = getAttendanceStatus(date, userData.attendances, userData.offDays);
                  const StatusIcon = STATUS_ICONS[status];
                  
                  return (
                    <td key={date.toISOString()} className="px-2 py-4 text-center">
                      <div
                        className={`
                          w-12 h-12 rounded-lg border-2 flex items-center justify-center mx-auto
                          ${STATUS_COLORS[status]}
                          transition-all duration-200 hover:scale-110
                        `}
                        title={`${userData.user.name} - ${format(date, 'MMM d, yyyy')} - ${status.replace('_', ' ').toUpperCase()}`}
                      >
                        <StatusIcon className="h-4 w-4" />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {data.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No attendance data available for the selected period.
        </div>
      )}
    </div>
  );
}