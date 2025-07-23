import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireSuperAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { 
  Users, 
  BarChart3, 
  Shield, 
  TrendingUp,
  Calendar,
  Clock
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireSuperAdmin(request);
  
  const today = new Date();
  const yesterday = subDays(today, 1);
  
  // Get total users count
  const totalUsers = await prisma.user.count();
  
  // Get users by role
  const usersByRole = await prisma.user.groupBy({
    by: ['role'],
    _count: {
      role: true,
    },
  });
  
  // Get today's attendance count
  const todayAttendance = await prisma.attendance.count({
    where: {
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
  });
  
  // Get yesterday's attendance count for comparison
  const yesterdayAttendance = await prisma.attendance.count({
    where: {
      date: {
        gte: startOfDay(yesterday),
        lte: endOfDay(yesterday),
      },
    },
  });
  
  // Get recent attendance records
  const recentAttendance = await prisma.attendance.findMany({
    take: 5,
    orderBy: {
      checkInTime: 'desc',
    },
    include: {
      user: {
        select: {
          name: true,
          department: true,
        },
      },
    },
  });
  
  return {
    user,
    stats: {
      totalUsers,
      usersByRole,
      todayAttendance,
      yesterdayAttendance,
      recentAttendance,
    },
  };
}

export default function SuperAdminDashboard() {
  const { user, stats } = useLoaderData<typeof loader>();
  
  const getRoleCount = (role: string) => {
    const roleData = stats.usersByRole.find(r => r.role === role);
    return roleData?._count.role || 0;
  };
  
  const attendanceChange = stats.todayAttendance - stats.yesterdayAttendance;
  const attendanceChangePercent = stats.yesterdayAttendance > 0 
    ? ((attendanceChange / stats.yesterdayAttendance) * 100).toFixed(1)
    : '0';
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
          <Shield className="h-6 w-6 mr-2" />
          Super Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          System overview and management controls
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Users
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.totalUsers}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Today's Attendance
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg font-medium text-gray-900">
                      {stats.todayAttendance}
                    </div>
                    <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                      attendanceChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <TrendingUp className="h-4 w-4 mr-1" />
                      {attendanceChange >= 0 ? '+' : ''}{attendanceChangePercent}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Users */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Admin Users
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {getRoleCount('ADMIN')}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Worker Users */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Worker Users
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {getRoleCount('WORKER')}
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
            stats.recentAttendance.map((attendance) => (
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
                        {attendance.user.department}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-900">
                      {format(new Date(attendance.checkInTime), 'HH:mm:ss')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(attendance.date), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/superadmin/users"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-700 ring-4 ring-white">
                  <Users className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" aria-hidden="true" />
                  Manage Users
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Create, edit, and manage user accounts and permissions.
                </p>
              </div>
            </a>

            <a
              href="/superadmin/attendance"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                  <BarChart3 className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" aria-hidden="true" />
                  Attendance Reports
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  View and export detailed attendance reports with photos.
                </p>
              </div>
            </a>

            <a
              href="/superadmin/profile"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-red-50 text-red-700 ring-4 ring-white">
                  <Shield className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" aria-hidden="true" />
                  Profile Settings
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Manage your super admin profile and security settings.
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}