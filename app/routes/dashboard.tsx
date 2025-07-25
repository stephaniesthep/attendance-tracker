import { useLoaderData, useRevalidator, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { getUserPrimaryRole, userHasRole } from "~/utils/auth";
import { prisma } from "~/utils/db.server";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import {
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Download,
  Shield,
  Users,
  House,
} from "lucide-react";
import { useEffect } from "react";
import { redirect } from "react-router";
import type { User } from "@prisma/client";
import {
  AttendanceMatrix,
  type UserAttendanceData,
} from "~/components/AttendanceMatrix";
import {
  DateRangeSelector,
  type ViewType,
} from "~/components/DateRangeSelector";
import { AttendanceMatrixSection } from "~/components/AttendanceMatrixSection";
import { TodayAttendanceWidget } from "~/components/TodayAttendanceWidget";

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

  // Parse URL search params for date and view type
  const url = new URL(request.url);
  const viewType = (url.searchParams.get("view") as ViewType) || "monthly";
  const selectedDateParam = url.searchParams.get("date");
  const selectedDate = selectedDateParam
    ? new Date(selectedDateParam)
    : new Date();

  const today = new Date();
  const todayFormatted = format(today, "yyyy-MM-dd");

  // Calculate date range for attendance matrix based on view type
  let startDate: Date;
  let endDate: Date;

  switch (viewType) {
    case "daily":
      startDate = new Date(selectedDate);
      endDate = new Date(selectedDate);
      break;
    case "weekly":
      startDate = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
      endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
      break;
    case "monthly":
      startDate = startOfMonth(selectedDate);
      endDate = endOfMonth(selectedDate);
      break;
    default:
      startDate = startOfMonth(selectedDate);
      endDate = endOfMonth(selectedDate);
  }

  if (isSuperAdmin) {
    // SuperAdmin view - show system-wide data
    const [
      totalUsers,
      usersByRole,
      totalWorkers,
      todayAttendanceCount,
      checkedInToday,
      completedToday,
      recentAttendance,
      workersWithAttendance,
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
      prisma.user.count({
        where: {
          roles: {
            some: {
              name: "WORKER",
            },
          },
        },
      }),
      prisma.attendance
        .groupBy({
          by: ["userId"],
          where: {
            date: todayFormatted,
          },
        })
        .then((result) => result.length),
      prisma.attendance.count({
        where: {
          date: todayFormatted,
          checkOut: null,
        },
      }),
      prisma.attendance.count({
        where: {
          date: todayFormatted,
          checkOut: { not: null },
        },
      }),
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
      prisma.user.findMany({
        where: {
          roles: {
            some: {
              name: "WORKER",
            },
          },
        },
        select: {
          id: true,
          name: true,
          department: true,
          attendances: {
            where: {
              date: {
                gte: format(startDate, "yyyy-MM-dd"),
                lte: format(endDate, "yyyy-MM-dd"),
              },
            },
            select: {
              id: true,
              userId: true,
              date: true,
              checkIn: true,
              checkOut: true,
              shift: true,
              status: true,
            },
          },
          offDays: {
            where: {
              OR: [
                {
                  startDate: {
                    lte: endDate,
                  },
                  endDate: {
                    gte: startDate,
                  },
                },
              ],
            },
            select: {
              id: true,
              userId: true,
              startDate: true,
              endDate: true,
              reason: true,
            },
          },
        },
      }),
    ]);

    // Transform data for AttendanceMatrix component
    const attendanceMatrixData: UserAttendanceData[] =
      workersWithAttendance.map((worker) => ({
        user: {
          id: worker.id,
          name: worker.name,
          department: worker.department,
        },
        attendances: worker.attendances,
        offDays: worker.offDays,
      }));

    return {
      user,
      userPrimaryRole: primaryRole,
      isSuperAdmin: true,
      isAdmin,
      canDownloadExcel: true,
      selectedDate: selectedDate.toISOString(),
      viewType,
      attendanceMatrixData,
      stats: {
        totalUsers,
        usersByRole,
        totalWorkers,
        todayAttendance: todayAttendanceCount,
        checkedInToday,
        completedToday,
        recentAttendance,
      },
      todayDate: todayFormatted,
      todayFormatted,
    };
  } else if (isAdmin) {
    // Admin view - show admin's own data + all workers data
    const [
      totalWorkers,
      todayAttendanceCount,
      checkedInToday,
      completedToday,
      recentWorkersAttendance,
      workersWithAttendance,
      adminAttendanceData,
      adminTodayAttendance,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          roles: {
            some: {
              name: "WORKER",
            },
          },
        },
      }),
      prisma.attendance
        .groupBy({
          by: ["userId"],
          where: {
            date: todayFormatted,
            user: {
              roles: {
                some: {
                  name: "WORKER",
                },
              },
            },
          },
        })
        .then((result) => result.length),
      prisma.attendance.count({
        where: {
          date: todayFormatted,
          checkOut: null,
          user: {
            roles: {
              some: {
                name: "WORKER",
              },
            },
          },
        },
      }),
      prisma.attendance.count({
        where: {
          date: todayFormatted,
          checkOut: { not: null },
          user: {
            roles: {
              some: {
                name: "WORKER",
              },
            },
          },
        },
      }),
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
      prisma.user.findMany({
        where: {
          roles: {
            some: {
              name: "WORKER",
            },
          },
        },
        select: {
          id: true,
          name: true,
          department: true,
          attendances: {
            where: {
              date: {
                gte: format(startDate, "yyyy-MM-dd"),
                lte: format(endDate, "yyyy-MM-dd"),
              },
            },
            select: {
              id: true,
              userId: true,
              date: true,
              checkIn: true,
              checkOut: true,
              shift: true,
              status: true,
            },
          },
          offDays: {
            where: {
              OR: [
                {
                  startDate: {
                    lte: endDate,
                  },
                  endDate: {
                    gte: startDate,
                  },
                },
              ],
            },
            select: {
              id: true,
              userId: true,
              startDate: true,
              endDate: true,
              reason: true,
            },
          },
        },
      }),
      // Get admin's own attendance data
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          department: true,
          attendances: {
            where: {
              date: {
                gte: format(startDate, "yyyy-MM-dd"),
                lte: format(endDate, "yyyy-MM-dd"),
              },
            },
            select: {
              id: true,
              userId: true,
              date: true,
              checkIn: true,
              checkOut: true,
              shift: true,
              status: true,
            },
          },
          offDays: {
            where: {
              OR: [
                {
                  startDate: {
                    lte: endDate,
                  },
                  endDate: {
                    gte: startDate,
                  },
                },
              ],
            },
            select: {
              id: true,
              userId: true,
              startDate: true,
              endDate: true,
              reason: true,
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

    // Transform workers data for AttendanceMatrix component
    const workersAttendanceMatrixData: UserAttendanceData[] =
      workersWithAttendance.map((worker) => ({
        user: {
          id: worker.id,
          name: worker.name,
          department: worker.department,
        },
        attendances: worker.attendances,
        offDays: worker.offDays,
      }));

    // Transform admin's own data for AttendanceMatrix component
    const adminAttendanceMatrixData: UserAttendanceData[] = adminAttendanceData
      ? [
          {
            user: {
              id: adminAttendanceData.id,
              name: adminAttendanceData.name,
              department: adminAttendanceData.department,
            },
            attendances: adminAttendanceData.attendances,
            offDays: adminAttendanceData.offDays,
          },
        ]
      : [];

    return {
      user,
      userPrimaryRole: primaryRole,
      isSuperAdmin: false,
      isAdmin: true,
      canDownloadExcel: true,
      selectedDate: selectedDate.toISOString(),
      viewType,
      workersAttendanceMatrixData,
      adminAttendanceMatrixData,
      adminTodayAttendance,
      stats: {
        totalWorkers,
        todayAttendance: todayAttendanceCount,
        checkedInToday,
        completedToday,
        recentWorkersAttendance,
      },
      todayFormatted,
    };
  } else {
    // Regular user view - show personal data
    const [todayAttendance, recentAttendance, userAttendanceData] =
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
        // Get user's attendance data for the selected period
        prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            department: true,
            attendances: {
              where: {
                date: {
                  gte: format(startDate, "yyyy-MM-dd"),
                  lte: format(endDate, "yyyy-MM-dd"),
                },
              },
              select: {
                id: true,
                userId: true,
                date: true,
                checkIn: true,
                checkOut: true,
                shift: true,
                status: true,
              },
            },
            offDays: {
              where: {
                OR: [
                  {
                    startDate: {
                      lte: endDate,
                    },
                    endDate: {
                      gte: startDate,
                    },
                  },
                ],
              },
              select: {
                id: true,
                userId: true,
                startDate: true,
                endDate: true,
                reason: true,
              },
            },
          },
        }),
      ]);

    // Transform data for AttendanceMatrix component
    const attendanceMatrixData: UserAttendanceData[] = userAttendanceData
      ? [
          {
            user: {
              id: userAttendanceData.id,
              name: userAttendanceData.name,
              department: userAttendanceData.department,
            },
            attendances: userAttendanceData.attendances,
            offDays: userAttendanceData.offDays,
          },
        ]
      : [];

    return {
      user,
      todayAttendance,
      recentAttendance,
      attendanceMatrixData,
      selectedDate: selectedDate.toISOString(),
      viewType,
      userPrimaryRole: primaryRole,
      isSuperAdmin: false,
      isAdmin,
      canDownloadExcel: isAdmin || isSuperAdmin,
      todayFormatted,
    };
  }
}

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const {
    user,
    attendanceMatrixData,
    selectedDate,
    viewType,
    canDownloadExcel,
    isSuperAdmin,
    todayFormatted,
  } = data;
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleDateChange = (date: Date) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("date", date.toISOString());
    setSearchParams(newSearchParams);
  };

  const handleViewTypeChange = (newViewType: ViewType) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("view", newViewType);
    setSearchParams(newSearchParams);
  };

  const getRoleCount = (roleName: string) => {
    if (!isSuperAdmin || !("stats" in data) || !data.stats) return 0;
    const roleData = data.stats.usersByRole.find((r) => r.name === roleName);
    return roleData?._count.users || 0;
  };

  const exportToExcel = async () => {
    // Determine which data to export based on user role
    let dataToExport: UserAttendanceData[] = [];
    let worksheetName = "Attendance Matrix";
    
    if (data.isAdmin && 'workersAttendanceMatrixData' in data) {
      // Admin view - export workers data
      dataToExport = (data as any).workersAttendanceMatrixData || [];
      worksheetName = "Workers Attendance Matrix";
    } else if (attendanceMatrixData) {
      // Regular user or SuperAdmin view
      dataToExport = attendanceMatrixData;
      worksheetName = isSuperAdmin ? "All Users Attendance Matrix" : "Personal Attendance Matrix";
    }

    if (!canDownloadExcel || dataToExport.length === 0) return;

    try {
      // Dynamic import to reduce bundle size
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(worksheetName);

      // Set column headers based on view type
      const dateRange = getDateRange(new Date(selectedDate), viewType);
      
      // Different headers for multi-user vs single user export
      const isMultiUser = dataToExport.length > 1;
      const headers = isMultiUser
        ? ["Employee", "Department", "Date", "Status", "Check In", "Check Out", "Duration", "Shift"]
        : ["Date", "Status", "Check In", "Check Out", "Duration", "Shift"];

      worksheet.columns = isMultiUser
        ? [
            { header: "Employee", key: "employee", width: 20 },
            { header: "Department", key: "department", width: 15 },
            { header: "Date", key: "date", width: 15 },
            { header: "Status", key: "status", width: 15 },
            { header: "Check In", key: "checkIn", width: 12 },
            { header: "Check Out", key: "checkOut", width: 12 },
            { header: "Duration", key: "duration", width: 12 },
            { header: "Shift", key: "shift", width: 12 },
          ]
        : [
            { header: "Date", key: "date", width: 15 },
            { header: "Status", key: "status", width: 15 },
            { header: "Check In", key: "checkIn", width: 12 },
            { header: "Check Out", key: "checkOut", width: 12 },
            { header: "Duration", key: "duration", width: 12 },
            { header: "Shift", key: "shift", width: 12 },
          ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6FA" },
      };

      // Process attendance data
      dataToExport.forEach((userData) => {
        dateRange.forEach((date) => {
          const dateString = format(date, "yyyy-MM-dd");
          const attendance = userData.attendances.find(
            (att) => att.date === dateString
          );

          // Determine status
          const isOffDay = userData.offDays.some((offDay) => {
            const startDate = new Date(offDay.startDate);
            const endDate = new Date(offDay.endDate);
            return date >= startDate && date <= endDate;
          });

          let status = "Absent";
          let checkIn = "-";
          let checkOut = "-";
          let duration = "-";
          let shift = "-";

          if (isOffDay) {
            status = "Off Day";
          } else if (attendance && attendance.checkIn) {
            status = "Present";
            checkIn = format(new Date(attendance.checkIn), "HH:mm:ss");
            if (attendance.checkOut) {
              checkOut = format(new Date(attendance.checkOut), "HH:mm:ss");
              const checkInTime = new Date(attendance.checkIn);
              const checkOutTime = new Date(attendance.checkOut);
              const durationMinutes = Math.floor(
                (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60)
              );
              duration = `${Math.floor(durationMinutes / 60)}h ${
                durationMinutes % 60
              }m`;
            }
            shift = attendance.shift || "Not specified";
          }

          const rowData = isMultiUser
            ? {
                employee: userData.user.name,
                department: userData.user.department || "No Department",
                date: format(date, "yyyy-MM-dd (EEE)"),
                status,
                checkIn,
                checkOut,
                duration,
                shift,
              }
            : {
                date: format(date, "yyyy-MM-dd (EEE)"),
                status,
                checkIn,
                checkOut,
                duration,
                shift,
              };

          worksheet.addRow(rowData);
        });
      });

      // Generate Excel file and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filePrefix = data.isAdmin ? "workers-attendance" :
                        isSuperAdmin ? "all-users-attendance" : "personal-attendance";
      a.download = `${filePrefix}-${format(
        new Date(selectedDate),
        "yyyy-MM-dd"
      )}-${viewType}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating Excel file:", error);
      alert("Error generating Excel file. Please try again.");
    }
  };

  // Helper function to generate date range (same as in AttendanceMatrix component)
  const getDateRange = (
    selectedDate: Date,
    viewType: "daily" | "weekly" | "monthly"
  ): Date[] => {
    switch (viewType) {
      case "daily":
        return [selectedDate];
      case "weekly":
        return eachDayOfInterval({
          start: startOfWeek(selectedDate, { weekStartsOn: 1 }), // Monday start
          end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
        });
      case "monthly":
        return eachDayOfInterval({
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate),
        });
      default:
        return [selectedDate];
    }
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

        {/* Today's Attendance Widget */}
        <TodayAttendanceWidget
          todayAttendance={stats.todayAttendance}
          totalWorkers={stats.totalWorkers}
          checkedInToday={stats.checkedInToday}
          completedToday={stats.completedToday}
          date={todayDate}
        />

        {/* Attendance Matrix Section */}
        <AttendanceMatrixSection
          attendanceData={attendanceMatrixData || []}
          selectedDate={new Date(selectedDate)}
          viewType={viewType}
          showUserNames={true}
        />

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
    const { stats, adminTodayAttendance, workersAttendanceMatrixData, adminAttendanceMatrixData } = data as any;

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
        </div>

        {/* Admin's Personal Attendance Matrix */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Your Attendance Matrix
            </h2>
            <DateRangeSelector
              selectedDate={new Date(selectedDate)}
              viewType={viewType}
              onDateChange={handleDateChange}
              onViewTypeChange={handleViewTypeChange}
            />
          </div>

          <AttendanceMatrix
            data={adminAttendanceMatrixData}
            viewType={viewType}
            selectedDate={new Date(selectedDate)}
            showUserNames={false} // Hide user names since it's personal view
          />
        </div>

        {/* All Workers Attendance Matrix */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Workers Attendance Matrix
            </h2>
            {canDownloadExcel && (
              <button
                onClick={exportToExcel}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </button>
            )}
          </div>

          <AttendanceMatrix
            data={workersAttendanceMatrixData}
            viewType={viewType}
            selectedDate={new Date(selectedDate)}
            showUserNames={true} // Show user names for workers
          />
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
        </div>

        {/* Personal Attendance Matrix Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <DateRangeSelector
              selectedDate={new Date(selectedDate)}
              viewType={viewType}
              onDateChange={handleDateChange}
              onViewTypeChange={handleViewTypeChange}
            />

            {canDownloadExcel && (
              <button
                onClick={exportToExcel}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </button>
            )}
          </div>

          <AttendanceMatrix
            data={attendanceMatrixData || []}
            viewType={viewType}
            selectedDate={new Date(selectedDate)}
            showUserNames={false} // Hide user names since it's personal view
          />
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
