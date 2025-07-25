import { useLoaderData, useRevalidator } from "react-router";

import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { format } from "date-fns";
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
import { useState, useEffect } from "react";
import { ArrowUpDown, Calendar, Download, Search, RefreshCw } from "lucide-react";

type AttendanceRecord = {
  id: string;
  userName: string;
  userDivision: string;
  date: string;
  shift: string | null;
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
  const date = dateParam ? dateParam : format(new Date(), 'yyyy-MM-dd');
  
  const attendances = await prisma.attendance.findMany({
    where: {
      date: date,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      checkIn: "desc",
    },
  });

  const records: AttendanceRecord[] = await Promise.all(
    attendances.map(async (attendance) => {
      // Calculate duration if both check-in and check-out exist
      let duration = null;
      if (attendance.checkIn && attendance.checkOut) {
        const checkInTime = new Date(attendance.checkIn);
        const checkOutTime = new Date(attendance.checkOut);
        duration = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60)); // duration in minutes
      }

      // Generate location names from coordinates using the location service
      let checkInLocationName = null;
      let checkOutLocationName = null;

      try {
        const { enhancedLocationService } = await import("~/utils/location.server.enhanced");
        
        // Get check-in location name
        if (attendance.locationIn) {
          try {
            const coordinates = JSON.parse(attendance.locationIn);
            if (coordinates.lat && coordinates.lng) {
              const locationResult = await enhancedLocationService.getLocationName(coordinates.lat, coordinates.lng);
              checkInLocationName = locationResult.name;
            }
          } catch (error) {
            console.error("Failed to parse check-in location:", error);
          }
        }

        // Get check-out location name
        if (attendance.locationOut) {
          try {
            const coordinates = JSON.parse(attendance.locationOut);
            if (coordinates.lat && coordinates.lng) {
              const locationResult = await enhancedLocationService.getLocationName(coordinates.lat, coordinates.lng);
              checkOutLocationName = locationResult.name;
            }
          } catch (error) {
            console.error("Failed to parse check-out location:", error);
          }
        }
      } catch (error) {
        console.error("Location service not available:", error);
      }

      return {
        id: attendance.id,
        userName: attendance.user.name,
        userDivision: "General", // Default since department field may not exist
        date: attendance.date,
        shift: (attendance as any).shift || null,
        checkInTime: attendance.checkIn ? format(new Date(attendance.checkIn), "HH:mm:ss") : "",
        checkOutTime: attendance.checkOut ? format(new Date(attendance.checkOut), "HH:mm:ss") : null,
        duration: duration,
        checkInLocation: attendance.locationIn || "",
        checkInLocationName: checkInLocationName,
        checkOutLocation: attendance.locationOut || null,
        checkOutLocationName: checkOutLocationName,
        checkInPhoto: attendance.photoIn || "",
        checkOutPhoto: attendance.photoOut || null,
      };
    })
  );

  return { records, currentDate: date };
}

// Function to determine shift based on check-in time
const getShift = (checkInTime: string): string => {
  const [hours, minutes] = checkInTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Morning shift: 7:00 AM to 11:00 AM (420 to 660 minutes)
  if (totalMinutes >= 420 && totalMinutes < 660) {
    return 'Morning';
  }
  // Afternoon shift: 12:00 PM to 8:00 PM (720 to 1200 minutes)
  else if (totalMinutes >= 720 && totalMinutes < 1200) {
    return 'Afternoon';
  }
  // Night shift: 9:00 PM to 2:00 AM (1260+ minutes or 0-120 minutes)
  else if (totalMinutes >= 1260 || totalMinutes < 120) {
    return 'Night';
  }
  // Outside defined shift hours
  else {
    return 'Other';
  }
};

const columnHelper = createColumnHelper<AttendanceRecord>();

export default function AdminAttendance() {
  const { records, currentDate } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // Auto-refresh every 30 seconds to get latest attendance data
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [revalidator, isAutoRefresh]);

  const handleManualRefresh = () => {
    revalidator.revalidate();
  };

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
    columnHelper.accessor("shift", {
      header: "Shift",
      cell: (info) => {
        const shift = info.getValue();
        // If shift is available from database, use it; otherwise calculate from check-in time
        if (shift) {
          return shift.charAt(0).toUpperCase() + shift.slice(1);
        }
        // Fallback to calculated shift for backward compatibility
        const row = info.row.original;
        return getShift(row.checkInTime);
      },
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
        
        // Always prioritize human-readable location name
        if (locationName && locationName.trim() !== '') {
          return (
            <div className="min-w-[200px] max-w-xs">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">{locationName}</span>
                {/* Show coordinates as secondary info if available */}
                {(() => {
                  try {
                    const location = JSON.parse(row.checkInLocation);
                    return (
                      <span className="text-xs text-gray-500 mt-1">
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </span>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
            </div>
          );
        }
        
        // Fallback to coordinates only if no location name
        try {
          const location = JSON.parse(row.checkInLocation);
          return (
            <div className="min-w-[150px]">
              <span className="text-xs text-gray-600">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
              <div className="text-xs text-red-500 mt-1">No location name</div>
            </div>
          );
        } catch {
          return (
            <div className="min-w-[150px]">
              <span className="text-xs text-red-500">Location unavailable</span>
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
        
        // Always prioritize human-readable location name
        if (locationName && locationName.trim() !== '') {
          return (
            <div className="min-w-[200px] max-w-xs">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">{locationName}</span>
                {/* Show coordinates as secondary info if available */}
                {(() => {
                  try {
                    const location = JSON.parse(row.checkOutLocation);
                    return (
                      <span className="text-xs text-gray-500 mt-1">
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </span>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
            </div>
          );
        }
        
        // Fallback to coordinates only if no location name
        try {
          const location = JSON.parse(row.checkOutLocation);
          return (
            <div className="min-w-[150px]">
              <span className="text-xs text-gray-600">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
              <div className="text-xs text-red-500 mt-1">No location name</div>
            </div>
          );
        } catch {
          return (
            <div className="min-w-[150px]">
              <span className="text-xs text-red-500">Location unavailable</span>
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
    const headers = ["Date", "Name", "Division", "Shift", "Check In", "Check Out", "Duration", "Check-in Location", "Check-out Location", "Check-in Photo", "Check-out Photo"];
    const rows = records.map((record) => {
      // Prioritize human-readable names, fallback to coordinates, then to "unavailable"
      const checkInLocation = (record.checkInLocationName && record.checkInLocationName.trim() !== '')
        ? record.checkInLocationName
        : (() => {
            try {
              const location = JSON.parse(record.checkInLocation);
              return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
            } catch {
              return 'Location unavailable';
            }
          })();
      
      const checkOutLocation = !record.checkOutLocation
        ? "-"
        : (record.checkOutLocationName && record.checkOutLocationName.trim() !== '')
          ? record.checkOutLocationName
          : (() => {
              try {
                const location = JSON.parse(record.checkOutLocation);
                return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
              } catch {
                return 'Location unavailable';
              }
            })();

      return [
        record.date,
        record.userName,
        record.userDivision,
        record.shift ? record.shift.charAt(0).toUpperCase() + record.shift.slice(1) : getShift(record.checkInTime),
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
    // Dynamic import to reduce bundle size
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // Set column headers with proper widths for IMAGE formulas
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Division', key: 'division', width: 15 },
      { header: 'Shift', key: 'shift', width: 12 },
      { header: 'Check In', key: 'checkIn', width: 12 },
      { header: 'Check Out', key: 'checkOut', width: 12 },
      { header: 'Duration', key: 'duration', width: 12 },
      { header: 'Check-in Location', key: 'checkInLocation', width: 35 },
      { header: 'Check-out Location', key: 'checkOutLocation', width: 35 },
      { header: 'Check-in Photo', key: 'checkInPhoto', width: 25 },
      { header: 'Check-out Photo', key: 'checkOutPhoto', width: 25 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Get the current domain for photo URLs
    const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const excelRowIndex = i + 2; // Excel is 1-indexed and we have a header row

      // Enhanced location processing with better accuracy
      const getLocationDisplay = (locationString: string | null, locationName: string | null): string => {
        // Prioritize human-readable location name
        if (locationName && locationName.trim() !== '' && locationName !== 'null') {
          return locationName;
        }
        
        // Fallback to coordinates with better formatting
        if (locationString) {
          try {
            const location = JSON.parse(locationString);
            if (location.lat && location.lng) {
              // Format coordinates with more precision and direction indicators
              const lat = parseFloat(location.lat);
              const lng = parseFloat(location.lng);
              const latDir = lat >= 0 ? 'N' : 'S';
              const lngDir = lng >= 0 ? 'E' : 'W';
              return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`;
            }
          } catch {
            // If parsing fails, return the raw string
            return locationString;
          }
        }
        
        return 'Location unavailable';
      };

      const checkInLocation = getLocationDisplay(record.checkInLocation, record.checkInLocationName);
      const checkOutLocation = record.checkOutLocation
        ? getLocationDisplay(record.checkOutLocation, record.checkOutLocationName)
        : "-";

      // Create photo URLs using the public route for Excel IMAGE function
      const checkInPhotoUrl = `${currentDomain}/public-photo/${record.id}/checkin`;
      const checkOutPhotoUrl = record.checkOutPhoto ? `${currentDomain}/public-photo/${record.id}/checkout` : null;

      // Add row data
      const row = worksheet.addRow({
        date: record.date,
        name: record.userName,
        division: record.userDivision,
        shift: record.shift ? record.shift.charAt(0).toUpperCase() + record.shift.slice(1) : getShift(record.checkInTime),
        checkIn: record.checkInTime,
        checkOut: record.checkOutTime || "-",
        duration: record.duration ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m` : "-",
        checkInLocation: checkInLocation,
        checkOutLocation: checkOutLocation,
        checkInPhoto: '',
        checkOutPhoto: '',
      });

      // Set row height to accommodate images
      worksheet.getRow(excelRowIndex).height = 130;

      // Add IMAGE formula for check-in photo (using public URL)
      if (record.checkInPhoto) {
        const checkInPhotoCell = row.getCell('checkInPhoto');
        try {
          // Use IMAGE function with public URL
          checkInPhotoCell.value = { formula: `IMAGE("${checkInPhotoUrl}")` };
          checkInPhotoCell.alignment = { vertical: 'middle', horizontal: 'center' };
          console.log(`✓ Added IMAGE formula for check-in photo: ${checkInPhotoUrl}`);
        } catch (error) {
          console.error(`✗ Failed to add IMAGE formula for ${record.userName}:`, error);
          // Fallback to hyperlink
          checkInPhotoCell.value = 'View Check-in Photo';
          checkInPhotoCell.note = checkInPhotoUrl;
          checkInPhotoCell.font = { color: { argb: 'FF0000FF' }, underline: true };
          checkInPhotoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      } else {
        const checkInPhotoCell = row.getCell('checkInPhoto');
        checkInPhotoCell.value = 'No Photo';
        checkInPhotoCell.font = { color: { argb: 'FF999999' } };
        checkInPhotoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Add IMAGE formula for check-out photo (using public URL)
      if (record.checkOutPhoto && checkOutPhotoUrl) {
        const checkOutPhotoCell = row.getCell('checkOutPhoto');
        try {
          // Use IMAGE function with public URL
          checkOutPhotoCell.value = { formula: `IMAGE("${checkOutPhotoUrl}")` };
          checkOutPhotoCell.alignment = { vertical: 'middle', horizontal: 'center' };
          console.log(`✓ Added IMAGE formula for check-out photo: ${checkOutPhotoUrl}`);
        } catch (error) {
          console.error(`✗ Failed to add IMAGE formula for ${record.userName}:`, error);
          // Fallback to hyperlink
          checkOutPhotoCell.value = 'View Check-out Photo';
          checkOutPhotoCell.note = checkOutPhotoUrl;
          checkOutPhotoCell.font = { color: { argb: 'FF0000FF' }, underline: true };
          checkOutPhotoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      } else {
        const checkOutPhotoCell = row.getCell('checkOutPhoto');
        checkOutPhotoCell.value = 'No Photo';
        checkOutPhotoCell.font = { color: { argb: 'FF999999' } };
        checkOutPhotoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }

    try {
      // Generate Excel file and download
      console.log('Generating Excel file with IMAGE formulas...');
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${currentDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('✓ Excel file generated successfully with IMAGE formulas');
    } catch (error) {
      console.error('✗ Error generating Excel file:', error);
      alert('Error generating Excel file. Please check the console for details.');
    }
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
            onClick={handleManualRefresh}
            disabled={revalidator.state === "loading"}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${revalidator.state === "loading" ? "animate-spin" : ""}`} />
            Refresh
          </button>
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