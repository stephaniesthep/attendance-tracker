import { Calendar, Users, Clock } from "lucide-react";
import { format } from "date-fns";

interface TodayAttendanceWidgetProps {
  todayAttendance: number;
  totalWorkers: number;
  checkedInToday?: number;
  completedToday?: number;
  date?: string;
}

export function TodayAttendanceWidget({
  todayAttendance,
  totalWorkers,
  checkedInToday,
  completedToday,
  date
}: TodayAttendanceWidgetProps) {
  const today = date ? new Date(date) : new Date();

  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 overflow-hidden shadow-lg rounded-lg text-white">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-blue-100" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-blue-100">
                Today's Attendance
              </h3>
              <p className="text-2xl font-bold text-white">
                {format(today, 'EEEE, MMMM dd, yyyy')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {todayAttendance}
            </div>
            <div className="text-sm text-blue-100">
              of {totalWorkers} workers
            </div>
          </div>
        </div>
        
        {/* Additional stats if provided */}
        {(checkedInToday !== undefined || completedToday !== undefined) && (
          <div className="mt-4 pt-4 border-t border-blue-400">
            <div className="grid grid-cols-2 gap-4">
              {checkedInToday !== undefined && (
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-blue-200 mr-2" />
                  <div>
                    <div className="text-sm text-blue-100">Currently In</div>
                    <div className="font-semibold text-white">{checkedInToday}</div>
                  </div>
                </div>
              )}
              {completedToday !== undefined && (
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-blue-200 mr-2" />
                  <div>
                    <div className="text-sm text-blue-100">Completed</div>
                    <div className="font-semibold text-white">{completedToday}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}