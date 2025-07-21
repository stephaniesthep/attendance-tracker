import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { format, startOfDay, endOfDay } from "date-fns";
import { Clock, Calendar, CheckCircle, XCircle } from "lucide-react";

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

  const recentAttendance = await prisma.attendance.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      date: "desc",
    },
    take: 5,
  });

  return { user, todayAttendance, recentAttendance };
}

export default function Dashboard() {
  const { user, todayAttendance, recentAttendance } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user.name}!
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                    {format(new Date(), "MMMM d, yyyy")}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {todayAttendance ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Today's Status
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {todayAttendance
                      ? todayAttendance.checkOutTime
                        ? "Completed"
                        : "Checked In"
                      : "Not Checked In"}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Check-in Time
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {todayAttendance
                      ? format(new Date(todayAttendance.checkInTime), "h:mm a")
                      : "-"}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Recent Attendance
          </h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {recentAttendance.length === 0 ? (
            <li className="px-4 py-4 sm:px-6">
              <p className="text-sm text-gray-500">No attendance records yet.</p>
            </li>
          ) : (
            recentAttendance.map((attendance) => (
              <li key={attendance.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {attendance.checkOutTime ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-400" />
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {format(new Date(attendance.date), "MMMM d, yyyy")}
                      </div>
                      <div className="text-sm text-gray-500">
                        Check-in: {format(new Date(attendance.checkInTime), "h:mm a")}
                        {attendance.checkOutTime && (
                          <> | Check-out: {format(new Date(attendance.checkOutTime), "h:mm a")}</>
                        )}
                      </div>
                    </div>
                  </div>
                  {attendance.duration && (
                    <div className="text-sm text-gray-500">
                      {Math.floor(attendance.duration / 60)}h {attendance.duration % 60}m
                    </div>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}