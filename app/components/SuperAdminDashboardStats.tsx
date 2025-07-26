import { Calendar, Users, Clock } from "lucide-react";
import { format } from "date-fns";

interface SuperAdminDashboardStatsProps {
  todayDate: string;
  workersPresent: number;
  totalWorkers: number;
  currentlyIn: number;
}

export function SuperAdminDashboardStats({
  todayDate,
  workersPresent,
  totalWorkers,
  currentlyIn
}: SuperAdminDashboardStatsProps) {
  const today = new Date(todayDate);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {/* Today's Date */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Today's Date
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {format(today, 'MMMM dd, yyyy')}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Workers Present */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Workers Present
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {workersPresent} / {totalWorkers}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Currently In */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Currently In
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {currentlyIn}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}