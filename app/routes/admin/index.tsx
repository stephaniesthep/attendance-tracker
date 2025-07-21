import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { Users, Calendar, Clock, TrendingUp } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  
  const today = new Date();
  
  // Get statistics
  const totalUsers = await prisma.user.count();
  const totalWorkers = await prisma.user.count({ where: { role: "WORKER" } });
  const totalAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  
  const todayAttendance = await prisma.attendance.count({
    where: {
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
  });
  
  const checkedInToday = await prisma.attendance.count({
    where: {
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
      checkOutTime: null,
    },
  });
  
  const completedToday = await prisma.attendance.count({
    where: {
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
      checkOutTime: { not: null },
    },
  });

  return {
    stats: {
      totalUsers,
      totalWorkers,
      totalAdmins,
      todayAttendance,
      checkedInToday,
      completedToday,
    },
  };
}

export default function AdminDashboard() {
  const { stats } = useLoaderData<typeof loader>();

  const cards = [
    {
      name: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "bg-blue-500",
      detail: `${stats.totalWorkers} Workers, ${stats.totalAdmins} Admins`,
    },
    {
      name: "Today's Attendance",
      value: stats.todayAttendance,
      icon: Calendar,
      color: "bg-green-500",
      detail: `Out of ${stats.totalWorkers} workers`,
    },
    {
      name: "Currently Checked In",
      value: stats.checkedInToday,
      icon: Clock,
      color: "bg-yellow-500",
      detail: "Workers currently on site",
    },
    {
      name: "Completed Today",
      value: stats.completedToday,
      icon: TrendingUp,
      color: "bg-purple-500",
      detail: "Checked in and out",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Overview of attendance system
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/admin/users"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Users className="h-4 w-4 mr-2" />
            Manage Users
          </Link>
          <Link
            to="/admin/attendance"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Calendar className="h-4 w-4 mr-2" />
            View Attendance
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${card.color}`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {card.name}
                    </dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">
                        {card.value}
                      </div>
                      <div className="text-xs text-gray-500">
                        {card.detail}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Quick Actions
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              to="/admin/users/new"
              className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
            >
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">Add New User</p>
                <p className="text-sm text-gray-500">Create a new worker or admin account</p>
              </div>
            </Link>

            <Link
              to="/admin/attendance"
              className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
            >
              <div className="flex-shrink-0">
                <Calendar className="h-6 w-6 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">Today's Report</p>
                <p className="text-sm text-gray-500">View detailed attendance for today</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}