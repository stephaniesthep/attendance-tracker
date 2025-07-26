import { useLoaderData, useSearchParams } from "react-router";
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
} from "date-fns";
import { Calendar, Users } from "lucide-react";
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

  // Parse separate admin and workers date params for admin dashboard
  const adminViewType = (url.searchParams.get("adminView") as ViewType) || "monthly";
  const adminSelectedDateParam = url.searchParams.get("adminDate");
  const adminSelectedDate = adminSelectedDateParam
    ? new Date(adminSelectedDateParam)
    : new Date();

  const workersViewType = (url.searchParams.get("workersView") as ViewType) || "monthly";
  const workersSelectedDateParam = url.searchParams.get("workersDate");
  const workersSelectedDate = workersSelectedDateParam
    ? new Date(workersSelectedDateParam)
    : new Date();

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
    // SuperAdmin view - show all users data
    const workersWithAttendance = await prisma.user.findMany({
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
    });

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
    };
  } else if (isAdmin) {
    // Calculate separate date ranges for admin and workers
    let adminStartDate: Date, adminEndDate: Date;
    let workersStartDate: Date, workersEndDate: Date;

    // Admin date range
    switch (adminViewType) {
      case "daily":
        adminStartDate = new Date(adminSelectedDate);
        adminEndDate = new Date(adminSelectedDate);
        break;
      case "weekly":
        adminStartDate = startOfWeek(adminSelectedDate, { weekStartsOn: 1 });
        adminEndDate = endOfWeek(adminSelectedDate, { weekStartsOn: 1 });
        break;
      case "monthly":
        adminStartDate = startOfMonth(adminSelectedDate);
        adminEndDate = endOfMonth(adminSelectedDate);
        break;
      default:
        adminStartDate = startOfMonth(adminSelectedDate);
        adminEndDate = endOfMonth(adminSelectedDate);
    }

    // Workers date range
    switch (workersViewType) {
      case "daily":
        workersStartDate = new Date(workersSelectedDate);
        workersEndDate = new Date(workersSelectedDate);
        break;
      case "weekly":
        workersStartDate = startOfWeek(workersSelectedDate, { weekStartsOn: 1 });
        workersEndDate = endOfWeek(workersSelectedDate, { weekStartsOn: 1 });
        break;
      case "monthly":
        workersStartDate = startOfMonth(workersSelectedDate);
        workersEndDate = endOfMonth(workersSelectedDate);
        break;
      default:
        workersStartDate = startOfMonth(workersSelectedDate);
        workersEndDate = endOfMonth(workersSelectedDate);
    }

    // Admin view - show admin's own data + all workers data
    const [
      workersWithAttendance,
      adminAttendanceData,
    ] = await Promise.all([
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
                gte: format(workersStartDate, "yyyy-MM-dd"),
                lte: format(workersEndDate, "yyyy-MM-dd"),
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
                    lte: workersEndDate,
                  },
                  endDate: {
                    gte: workersStartDate,
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
                gte: format(adminStartDate, "yyyy-MM-dd"),
                lte: format(adminEndDate, "yyyy-MM-dd"),
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
                    lte: adminEndDate,
                  },
                  endDate: {
                    gte: adminStartDate,
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
      // Admin-specific date info
      adminSelectedDate: adminSelectedDate.toISOString(),
      adminViewType,
      // Workers-specific date info
      workersSelectedDate: workersSelectedDate.toISOString(),
      workersViewType,
      workersAttendanceMatrixData,
      adminAttendanceMatrixData,
    };
  } else {
    // Regular user view - show personal data only
    const userAttendanceData = await prisma.user.findUnique({
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
    });

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
      userPrimaryRole: primaryRole,
      isSuperAdmin: false,
      isAdmin: false,
      canDownloadExcel: isAdmin || isSuperAdmin,
      selectedDate: selectedDate.toISOString(),
      viewType,
      attendanceMatrixData,
    };
  }
}

export default function AttendanceMatrixPage() {
  const data = useLoaderData<typeof loader>();
  const {
    selectedDate,
    viewType,
    canDownloadExcel,
    isSuperAdmin,
    isAdmin,
  } = data;
  const [searchParams, setSearchParams] = useSearchParams();

  // Admin-specific date handlers
  const handleAdminDateChange = (date: Date) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("adminDate", date.toISOString());
    setSearchParams(newSearchParams);
  };

  const handleAdminViewTypeChange = (newViewType: ViewType) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("adminView", newViewType);
    setSearchParams(newSearchParams);
  };

  // Workers-specific date handlers
  const handleWorkersDateChange = (date: Date) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("workersDate", date.toISOString());
    setSearchParams(newSearchParams);
  };

  const handleWorkersViewTypeChange = (newViewType: ViewType) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("workersView", newViewType);
    setSearchParams(newSearchParams);
  };

  if (isSuperAdmin) {
    const { attendanceMatrixData } = data as any;

    const exportToExcel = async () => {
      if (!canDownloadExcel || !attendanceMatrixData || attendanceMatrixData.length === 0) {
        alert("No data available to export.");
        return;
      }

      try {
        const { exportAttendanceMatrixToExcel } = await import("~/utils/attendance-matrix-excel");
        
        await exportAttendanceMatrixToExcel({
          data: attendanceMatrixData,
          selectedDate: new Date(selectedDate),
          viewType: viewType as any,
          userRole: 'superadmin',
          showUserNames: true,
          worksheetName: "All Users Attendance Matrix"
        });
      } catch (error) {
        console.error("Error generating Excel file:", error);
        alert("Error generating Excel file. Please try again.");
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Calendar className="h-6 w-6 mr-2" />
            Attendance Matrix
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            View attendance matrix for all users
          </p>
        </div>

        {/* Attendance Matrix Section */}
        <AttendanceMatrixSection
          attendanceData={attendanceMatrixData || []}
          selectedDate={new Date(selectedDate)}
          viewType={viewType}
          showUserNames={true}
          canExport={canDownloadExcel}
          userRole="superadmin"
          onExport={exportToExcel}
        />
      </div>
    );
  } else if (isAdmin) {
    const {
      workersAttendanceMatrixData,
      adminAttendanceMatrixData,
      adminSelectedDate,
      adminViewType,
      workersSelectedDate,
      workersViewType
    } = data as any;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Calendar className="h-6 w-6 mr-2" />
            Attendance Matrix
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            View your personal attendance matrix and workers' attendance matrix
          </p>
        </div>

        {/* Admin's Personal Attendance Matrix */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Your Attendance Matrix
            </h2>
            <DateRangeSelector
              selectedDate={new Date(adminSelectedDate)}
              viewType={adminViewType}
              onDateChange={handleAdminDateChange}
              onViewTypeChange={handleAdminViewTypeChange}
            />
          </div>

          <AttendanceMatrix
            data={adminAttendanceMatrixData}
            viewType={adminViewType}
            selectedDate={new Date(adminSelectedDate)}
            showUserNames={false} // Hide user names since it's personal view
            canExport={true}
            userRole="admin"
            onExport={() => {
              // Custom export for admin's personal data
              const exportPersonalData = async () => {
                try {
                  const { exportAttendanceMatrixToExcel } = await import("~/utils/attendance-matrix-excel");
                  await exportAttendanceMatrixToExcel({
                    data: adminAttendanceMatrixData,
                    selectedDate: new Date(adminSelectedDate),
                    viewType: adminViewType as any,
                    userRole: 'admin',
                    showUserNames: false,
                    worksheetName: "Admin Personal Attendance Matrix"
                  });
                } catch (error) {
                  console.error("Error exporting personal attendance:", error);
                  alert("Error generating Excel file. Please try again.");
                }
              };
              exportPersonalData();
            }}
          />
        </div>

        {/* All Workers Attendance Matrix */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Workers Attendance Matrix
            </h2>
            <DateRangeSelector
              selectedDate={new Date(workersSelectedDate)}
              viewType={workersViewType}
              onDateChange={handleWorkersDateChange}
              onViewTypeChange={handleWorkersViewTypeChange}
            />
          </div>

          <AttendanceMatrix
            data={workersAttendanceMatrixData}
            viewType={workersViewType}
            selectedDate={new Date(workersSelectedDate)}
            showUserNames={true} // Show user names for workers
            canExport={true}
            userRole="admin"
            onExport={() => {
              // Custom export for workers data
              const exportWorkersData = async () => {
                try {
                  const { exportAttendanceMatrixToExcel } = await import("~/utils/attendance-matrix-excel");
                  await exportAttendanceMatrixToExcel({
                    data: workersAttendanceMatrixData,
                    selectedDate: new Date(workersSelectedDate),
                    viewType: workersViewType as any,
                    userRole: 'admin',
                    showUserNames: true,
                    worksheetName: "Workers Attendance Matrix"
                  });
                } catch (error) {
                  console.error("Error exporting workers attendance:", error);
                  alert("Error generating Excel file. Please try again.");
                }
              };
              exportWorkersData();
            }}
          />
        </div>
      </div>
    );
  } else {
    // Regular user view
    const { attendanceMatrixData } = data as any;

    const exportToExcel = async () => {
      if (!canDownloadExcel || !attendanceMatrixData || attendanceMatrixData.length === 0) {
        alert("No data available to export.");
        return;
      }

      try {
        const { exportAttendanceMatrixToExcel } = await import("~/utils/attendance-matrix-excel");
        
        await exportAttendanceMatrixToExcel({
          data: attendanceMatrixData,
          selectedDate: new Date(selectedDate),
          viewType: viewType as any,
          userRole: 'worker',
          showUserNames: false,
          worksheetName: "Personal Attendance Matrix"
        });
      } catch (error) {
        console.error("Error generating Excel file:", error);
        alert("Error generating Excel file. Please try again.");
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Calendar className="h-6 w-6 mr-2" />
            Attendance Matrix
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            View your personal attendance matrix
          </p>
        </div>

        {/* Personal Attendance Matrix Section */}
        <AttendanceMatrixSection
          attendanceData={attendanceMatrixData || []}
          selectedDate={new Date(selectedDate)}
          viewType={viewType}
          showUserNames={false} // Hide user names for personal view
          canExport={canDownloadExcel}
          userRole="worker"
          onExport={exportToExcel}
        />
      </div>
    );
  }
}