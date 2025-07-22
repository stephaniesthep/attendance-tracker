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

import ExcelJS from "exceljs";

type AttendanceRecord = {
  id: string;
  userName: string;
  userDivision: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  duration: number | null;
  checkInLocation: string;
  checkInLocationName: string | null;
  checkOutLocation: string | null;
  checkOutLocationName: string | null;
  checkInPhoto: string;
  checkOutPhoto: string | null;
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
    userDivision: (attendance.user as any).division || attendance.user.department,
    date: format(new Date(attendance.date), "yyyy-MM-dd"),
    checkInTime: format(new Date(attendance.checkInTime), "HH:mm:ss"),
    checkOutTime: attendance.checkOutTime
      ? format(new Date(attendance.checkOutTime), "HH:mm:ss")
      : null,
    duration: attendance.duration,
    checkInLocation: attendance.checkInLocation,
    checkInLocationName: (attendance as any).checkInLocationName || null,
    checkOutLocation: attendance.checkOutLocation,
    checkOutLocationName: (attendance as any).checkOutLocationName || null,
    checkInPhoto: attendance.checkInPhoto,
    checkOutPhoto: attendance.checkOutPhoto,
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
    columnHelper.accessor("userDivision", {
      header: "Division",
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
    columnHelper.accessor("checkInLocationName", {
      header: "Check-in Location",
      cell: (info) => {
        const locationName = info.getValue();
        const row = info.row.original;
        
        // First try to get the location name
        if (locationName && locationName.trim() !== '') {
          return (
            <div className="min-w-[200px] max-w-xs">
              <span className="text-sm">{locationName}</span>
            </div>
          );
        }
        
        // Fallback to coordinates if no location name
        try {
          const location = JSON.parse(row.checkInLocation);
          return (
            <div className="min-w-[150px]">
              <span className="text-xs">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
            </div>
          );
        } catch {
          return (
            <div className="min-w-[150px]">
              <span className="text-xs text-gray-500">Location unavailable</span>
            </div>
          );
        }
      },
    }),
    columnHelper.accessor("checkInPhoto", {
      header: "Check-in Photo",
      cell: (info) => {
        const photo = info.getValue();
        const row = info.row.original;
        return (
          <div className="flex justify-center">
            <img
              src={photo}
              alt="Check-in"
              className="w-16 h-20 object-cover rounded cursor-pointer hover:scale-110 transition-transform"
              onClick={() => window.open(`/photo/${row.id}/checkin`, '_blank')}
            />
          </div>
        );
      },
    }),
    columnHelper.accessor("checkOutLocationName", {
      header: "Check-out Location",
      cell: (info) => {
        const locationName = info.getValue();
        const row = info.row.original;
        
        // If no checkout, show dash
        if (!row.checkOutLocation) return "-";
        
        // First try to get the location name
        if (locationName && locationName.trim() !== '') {
          return (
            <div className="min-w-[200px] max-w-xs">
              <span className="text-sm">{locationName}</span>
            </div>
          );
        }
        
        // Fallback to coordinates if no location name
        try {
          const location = JSON.parse(row.checkOutLocation);
          return (
            <div className="min-w-[150px]">
              <span className="text-xs">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
            </div>
          );
        } catch {
          return (
            <div className="min-w-[150px]">
              <span className="text-xs text-gray-500">Location unavailable</span>
            </div>
          );
        }
      },
    }),
    columnHelper.accessor("checkOutPhoto", {
      header: "Check-out Photo",
      cell: (info) => {
        const photo = info.getValue();
        const row = info.row.original;
        if (!photo) return "-";
        return (
          <div className="flex justify-center">
            <img
              src={photo}
              alt="Check-out"
              className="w-16 h-20 object-cover rounded cursor-pointer hover:scale-110 transition-transform"
              onClick={() => window.open(`/photo/${row.id}/checkout`, '_blank')}
            />
          </div>
        );
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
    const headers = ["Name", "Division", "Check In", "Check Out", "Duration", "Check-in Location", "Check-out Location", "Check-in Photo", "Check-out Photo"];
    const rows = records.map((record) => {
      const checkInLocation = (record.checkInLocationName && record.checkInLocationName.trim() !== '')
        ? record.checkInLocationName
        : 'Location unavailable';
      
      const checkOutLocation = !record.checkOutLocation
        ? "-"
        : (record.checkOutLocationName && record.checkOutLocationName.trim() !== '')
          ? record.checkOutLocationName
          : 'Location unavailable';

      return [
        record.userName,
        record.userDivision,
        record.checkInTime,
        record.checkOutTime || "-",
        record.duration ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m` : "-",
        checkInLocation,
        checkOutLocation,
        `http://localhost:3000/photo/${record.id}/checkin`,
        record.checkOutPhoto ? `http://localhost:3000/photo/${record.id}/checkout` : "-",
      ];
    });

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

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // Set column headers
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Division', key: 'division', width: 15 },
      { header: 'Check In', key: 'checkIn', width: 12 },
      { header: 'Check Out', key: 'checkOut', width: 12 },
      { header: 'Duration', key: 'duration', width: 12 },
      { header: 'Check-in Location', key: 'checkInLocation', width: 30 },
      { header: 'Check-out Location', key: 'checkOutLocation', width: 30 },
      { header: 'Check-in Photo', key: 'checkInPhoto', width: 20 },
      { header: 'Check-out Photo', key: 'checkOutPhoto', width: 20 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Add data rows
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowIndex = i + 2; // +2 because Excel is 1-indexed and we have a header row

      const checkInLocation = (record.checkInLocationName && record.checkInLocationName.trim() !== '')
        ? record.checkInLocationName
        : 'Location unavailable';
      
      const checkOutLocation = !record.checkOutLocation
        ? "-"
        : (record.checkOutLocationName && record.checkOutLocationName.trim() !== '')
          ? record.checkOutLocationName
          : 'Location unavailable';

      // Add row data
      const row = worksheet.addRow({
        name: record.userName,
        division: record.userDivision,
        checkIn: record.checkInTime,
        checkOut: record.checkOutTime || "-",
        duration: record.duration ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m` : "-",
        checkInLocation: checkInLocation,
        checkOutLocation: checkOutLocation,
        checkInPhoto: 'View Check-in Photo',
        checkOutPhoto: record.checkOutPhoto ? 'View Check-out Photo' : '-',
      });

      // Add hyperlinks for photo columns
      const checkInPhotoCell = row.getCell('checkInPhoto');
      checkInPhotoCell.value = {
        text: 'View Check-in Photo',
        hyperlink: `http://localhost:3000/photo/${record.id}/checkin`
      };
      checkInPhotoCell.font = { color: { argb: 'FF0000FF' }, underline: true };

      if (record.checkOutPhoto) {
        const checkOutPhotoCell = row.getCell('checkOutPhoto');
        checkOutPhotoCell.value = {
          text: 'View Check-out Photo',
          hyperlink: `http://localhost:3000/photo/${record.id}/checkout`
        };
        checkOutPhotoCell.font = { color: { argb: 'FF0000FF' }, underline: true };
      }

      // Set row height to accommodate images
      worksheet.getRow(rowIndex).height = 80;

      // Add check-in photo
      if (record.checkInPhoto) {
        try {
          // Convert base64 to buffer
          const base64Data = record.checkInPhoto.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: 'png',
          });

          worksheet.addImage(imageId, {
            tl: { col: 7, row: rowIndex - 1 }, // H column (0-indexed)
            ext: { width: 60, height: 75 }
          });
        } catch (error) {
          console.error('Error adding check-in image:', error);
        }
      }

      // Add check-out photo
      if (record.checkOutPhoto) {
        try {
          // Convert base64 to buffer
          const base64Data = record.checkOutPhoto.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: 'png',
          });

          worksheet.addImage(imageId, {
            tl: { col: 8, row: rowIndex - 1 }, // I column (0-indexed)
            ext: { width: 60, height: 75 }
          });
        } catch (error) {
          console.error('Error adding check-out image:', error);
        }
      }
    }

    // Generate Excel file and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${currentDate}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Daily Attendance Report</h1>
          <p className="mt-1 text-sm text-gray-600">
            View attendance records with photos and location names for selected date
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel (with Photos)
          </button>
        </div>
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

            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
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
                            className="px-6 py-4 text-sm text-gray-900"
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