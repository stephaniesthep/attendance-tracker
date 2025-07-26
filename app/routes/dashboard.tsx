import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { getUserPrimaryRole, userHasRole } from "~/utils/auth";
import { prisma } from "~/utils/db.server";
import { getWorkerAttendanceStats } from "~/utils/attendance-stats.server";
import { format } from "date-fns";
import {
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Shield,
  Users,
  House,
} from "lucide-react";
import { useEffect } from "react";
import type { User } from "@prisma/client";
import { TodayAttendanceWidget } from "~/components/TodayAttendanceWidget";
import { CheckoutTimeWidget } from "~/components/CheckoutTimeWidget";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // User already has roles loaded from requireUser -> getUserFromToken
  // Determine user's primary role using RBAC
  const primaryRole = getUserPrimaryRole(
    user as User & { roles: { name: string }[] }
  );
  const isSuperAdmin = userHasRole(
    user as User & { roles: { name: string }[] },
    "SUPERADMIN"
  );
  const isAdmin = userHasRole(
    user as User & { roles: { name: string }[] },
    "ADMIN"
  );

  const today = new Date();
  const todayFormatted = format(today, "yyyy-MM-dd");

  if (isSuperAdmin) {
    // SuperAdmin view - show system-wide data using unified service
    const [
      totalUsers,
      usersByRole,
      workerStats,
      recentAttendance,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.role.findMany({
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
      }),
      // Use unified attendance statistics service
      getWorkerAttendanceStats(today),
      prisma.attendance.findMany({
        take: 5,
        orderBy: {
          checkIn: "desc",
        },
        include: {
          user: {
            select: {
              name: true,
              roles: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      user,
      userPrimaryRole: primaryRole,
      isSuperAdmin: true,
      isAdmin,
      stats: {
        totalUsers,
        usersByRole,
        totalWorkers: workerStats.totalWorkers,
        todayAttendance: workerStats.workersPresent,
        checkedInToday: workerStats.currentlyIn,
        completedToday: workerStats.completedToday,
        recentAttendance,
      },
      todayDate: workerStats.todayDate,
      todayFormatted,
    };
  } else if (isAdmin) {
    // Admin view - show admin's own data + all workers data using unified service
    const [
      workerStats,
      recentWorkersAttendance,
      adminTodayAttendance,
    ] = await Promise.all([
      // Use unified attendance statistics service for consistent worker stats
      getWorkerAttendanceStats(today),
      prisma.attendance.findMany({
        take: 10,
        orderBy: {
          checkIn: "desc",
        },
        where: {
          user: {
            roles: {
              some: {
                name: "WORKER",
              },
            },
          },
        },
        include: {
          user: {
            select: {
              name: true,
              department: true,
              roles: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      // Get admin's today attendance
      prisma.attendance.findFirst({
        where: {
          userId: user.id,
          date: todayFormatted,
        },
      }),
    ]);

    return {
      user,
      userPrimaryRole: primaryRole,
      isSuperAdmin: false,
      isAdmin: true,
      adminTodayAttendance,
      stats: {
        totalWorkers: workerStats.totalWorkers,
        todayAttendance: workerStats.workersPresent,
        checkedInToday: workerStats.currentlyIn,
        completedToday: workerStats.completedToday,
        recentWorkersAttendance,
      },
      todayFormatted,
    };
  } else {
    // Regular user view - show personal data
    const [todayAttendance, recentAttendance] =
      await Promise.all([
        prisma.attendance.findFirst({
          where: {
            userId: user.id,
            date: todayFormatted,
          },
        }),
        prisma.attendance.findMany({
          where: {
            userId: user.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        }),
      ]);

    return {
      user,
      todayAttendance,
      recentAttendance,
      userPrimaryRole: primaryRole,
      isSuperAdmin: false,
      isAdmin,
      todayFormatted,
    };
  }
}

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const {
    user,
    isSuperAdmin,
    todayFormatted,
  } = data;
  const revalidator = useRevalidator();

  const getRoleCount = (roleName: string) => {
    if (!isSuperAdmin || !("stats" in data) || !data.stats || !data.stats.usersByRole) return 0;
    const roleData = data.stats.usersByRole.find((r) => r.name === roleName);
    return roleData?._count.users || 0;
  };

  // Auto-refresh every 30 seconds to get latest attendance data
  useEffect(() => {
    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [revalidator]);

  if (isSuperAdmin) {
  // SuperAdmin Dashboard View
  const { stats, todayDate } = data as any;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
          <House className="h-6 w-6 mr-2" />
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-600">Attendance overview</p>
      </div>

      {/* SuperAdmin Status Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                    {format(new Date(todayDate), "MMMM d, yyyy")}
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
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Workers Present
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.todayAttendance} / {stats.totalWorkers}
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
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Currently In
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.checkedInToday}
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
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Completed Today
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.completedToday}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Recent Activity */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Attendance Activity
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Latest check-ins across the system
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            {stats.recentAttendance.length === 0 ? (
              <li className="px-4 py-4 text-center text-sm text-gray-500">
                No recent attendance records found.
              </li>
            ) : (
              stats.recentAttendance.map((attendance: any) => (
                <li key={attendance.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <Users className="h-5 w-5 text-gray-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {attendance.user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {attendance.user.roles[0]?.name || "No Role"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-900">
                        {attendance.checkIn
                          ? format(new Date(attendance.checkIn), "HH:mm:ss")
                          : "No check-in"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(attendance.date), "MMM dd, yyyy")}
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    );
  } else if (data.isAdmin) {
    // Admin Dashboard View
    const {
      stats,
      adminTodayAttendance,
    } = data as any;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Shield className="h-6 w-6 mr-2" />
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Welcome back, {user.name}! Manage your team's attendance.
          </p>
        </div>

        {/* Admin Status Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
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
                      {format(new Date(todayFormatted), "MMMM d, yyyy")}
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
                  {adminTodayAttendance ? (
                    <CheckCircle className="h-6 w-6 text-green-400" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-400" />
                  )}
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Your Status
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {adminTodayAttendance
                        ? adminTodayAttendance.checkOut
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
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Workers Present
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.todayAttendance} / {stats.totalWorkers}
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
                  <Clock className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Currently In
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.checkedInToday}
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
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Completed Today
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.completedToday}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Workers Attendance */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Workers Attendance
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Latest check-ins from your workers
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            {stats.recentWorkersAttendance.length === 0 ? (
              <li className="px-4 py-4 text-center text-sm text-gray-500">
                No recent attendance records found.
              </li>
            ) : (
              stats.recentWorkersAttendance.map((attendance: any) => (
                <li key={attendance.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <Users className="h-5 w-5 text-gray-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {attendance.user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {attendance.user.department || "No Department"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-900">
                        {attendance.checkIn
                          ? format(new Date(attendance.checkIn), "HH:mm:ss")
                          : "No check-in"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(attendance.date), "MMM dd, yyyy")}
                      </div>
                      <div className="text-xs text-gray-400">
                        {attendance.checkOut
                          ? `Out: ${format(new Date(attendance.checkOut), "HH:mm:ss")}`
                          : "Still checked in"}
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    );
  } else {
    // Regular User Dashboard View
    const { todayAttendance, recentAttendance } = data as any;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <House className="h-6 w-6 mr-2" />
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Welcome back, {user.name}!
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                      {format(new Date(todayFormatted), "MMMM d, yyyy")}
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
                        ? todayAttendance.checkOut
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
                      {todayAttendance && todayAttendance.checkIn
                        ? format(new Date(todayAttendance.checkIn), "h:mm a")
                        : "-"}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Time Widget */}
          <CheckoutTimeWidget todayAttendance={todayAttendance} />
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
                <p className="text-sm text-gray-500">
                  No attendance records yet.
                </p>
              </li>
            ) : (
              recentAttendance.map((attendance: any) => (
                <li key={attendance.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {attendance.checkOut ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-400" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {attendance.date}
                        </div>
                        <div className="text-sm text-gray-500">
                          {attendance.checkIn && (
                            <>
                              Check-in:{" "}
                              {format(new Date(attendance.checkIn), "h:mm a")}
                            </>
                          )}
                          {attendance.checkOut && (
                            <>
                              {" "}
                              | Check-out:{" "}
                              {format(new Date(attendance.checkOut), "h:mm a")}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    );
  }
}
