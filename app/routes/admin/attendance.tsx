import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown, Calendar, Download, Search } from "lucide-react";

type AttendanceRecord = {
  id: string;
  userName: string;
  userDepartment: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  duration: number | null;
  checkInLocation: string;
  checkOutLocation: string | null;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  
  const attendances = await prisma.attendance.findMany({
    where: {
      date: {
        gte: startOfDay(date),
        lte: endOfDay(date),
      },
    },
    include: {
      user: {
        select: {
          name: true,
          department: true,
        },
      },
    },
    orderBy: {
      checkInTime: "desc",
    },
  });

  const records: AttendanceRecord[] = attendances.map((attendance) => ({
    id: attendance.id,
    userName: attendance.user.name,
    userDepartment: attendance.user.department,
    date: format(new Date(attendance.date), "yyyy-MM-dd"),
    checkInTime: format(new Date(attendance.checkInTime), "HH:mm:ss"),
    checkOutTime: attendance.checkOutTime
      ? format(new Date(attendance.checkOutTime), "HH:mm:ss")
      : null,
    duration: attendance.duration,
    checkInLocation: attendance.checkInLocation,
    checkOutLocation: attendance.checkOutLocation,
  }));

  return { records, currentDate: format(date, "yyyy-MM-dd") };
}

const columnHelper = createColumnHelper<AttendanceRecord>();

export default function AdminAttendance() {
  const { records, currentDate } = useLoaderData<typeof loader>();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = [
    columnHelper.accessor("userName", {
      header: ({ column }) => (
        <button
          className="flex items-center space-x-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <span>Name</span>
          <ArrowUpDown className="h-4 w-4" />
        </button>
      ),
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("userDepartment", {
      header: "Department",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("checkInTime", {
      header: ({ column }) => (
        <button
          className="flex items-center space-x-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <span>Check In</span>
          <ArrowUpDown className="h-4 w-4" />
        </button>
      ),
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("checkOutTime", {
      header: "Check Out",
      cell: (info) => info.getValue() || "-",
    }),
    columnHelper.accessor("duration", {
      header: "Duration",
      cell: (info) => {
        const duration = info.getValue();
        if (!duration) return "-";
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        return `${hours}h ${minutes}m`;
      },
    }),
    columnHelper.accessor("checkInLocation", {
      header: "Location",
      cell: (info) => {
        try {
          const location = JSON.parse(info.getValue());
          return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
        } catch {
          return info.getValue();
        }
      },
    }),
  ];

  const table = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const exportToCSV = () => {
    const headers = ["Name", "Department", "Check In", "Check Out", "Duration", "Location"];
    const rows = records.map((record) => [
      record.userName,
      record.userDepartment,
      record.checkInTime,
      record.checkOutTime || "-",
      record.duration ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m` : "-",
      record.checkInLocation,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${currentDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Attendance Records</h1>
          <p className="mt-1 text-sm text-gray-600">
            Daily attendance tracking and reporting
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => {
                      window.location.href = `/admin/attendance?date=${e.target.value}`;
                    }}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder="Search records..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {records.length} records found
              </div>
            </div>

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        No attendance records found for this date.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}