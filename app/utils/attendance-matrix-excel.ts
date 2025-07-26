import { format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import type { UserAttendanceData, AttendanceStatus } from "~/components/AttendanceMatrix";
import { ATTENDANCE_STATUS, getAttendanceStatus } from "~/components/AttendanceMatrix";
import type { ViewType } from "~/components/DateRangeSelector";

// Excel color mappings for attendance statuses (using ARGB format)
export const EXCEL_STATUS_COLORS = {
  [ATTENDANCE_STATUS.OFF_DAY]: {
    fill: 'FFFECACA', // Light red background
    font: 'FF991B1B', // Dark red text
    border: 'FFDC2626' // Red border
  },
  [ATTENDANCE_STATUS.MORNING_SHIFT]: {
    fill: 'FFFBBF24', // Yellow background
    font: 'FF78350F', // Dark yellow text
    border: 'FFEAB308' // Yellow border
  },
  [ATTENDANCE_STATUS.AFTERNOON_SHIFT]: {
    fill: 'FFFB923C', // Orange background
    font: 'FF9A3412', // Dark orange text
    border: 'FFF97316' // Orange border
  },
  [ATTENDANCE_STATUS.NIGHT_SHIFT]: {
    fill: 'FF2563EB', // Blue background
    font: 'FFFFFFFF', // White text
    border: 'FF1D4ED8' // Dark blue border
  },
  [ATTENDANCE_STATUS.ABSENT]: {
    fill: 'FFE5E7EB', // Light gray background
    font: 'FF6B7280', // Gray text
    border: 'FF9CA3AF' // Gray border
  },
  [ATTENDANCE_STATUS.PRESENT]: {
    fill: 'FF4ADE80', // Green background
    font: 'FF14532D', // Dark green text
    border: 'FF16A34A' // Green border
  }
} as const;

// Status display names for Excel
export const STATUS_DISPLAY_NAMES = {
  [ATTENDANCE_STATUS.OFF_DAY]: 'Off Day',
  [ATTENDANCE_STATUS.MORNING_SHIFT]: 'Morning',
  [ATTENDANCE_STATUS.AFTERNOON_SHIFT]: 'Afternoon',
  [ATTENDANCE_STATUS.NIGHT_SHIFT]: 'Night',
  [ATTENDANCE_STATUS.ABSENT]: 'Absent',
  [ATTENDANCE_STATUS.PRESENT]: 'Present'
} as const;

// Generate date range based on view type
function getDateRange(selectedDate: Date, viewType: ViewType): Date[] {
  switch (viewType) {
    case 'daily':
      return [selectedDate];
    case 'weekly':
      return eachDayOfInterval({
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }), // Monday start
        end: endOfWeek(selectedDate, { weekStartsOn: 1 })
      });
    case 'monthly':
      return eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate)
      });
    case 'range':
      // For range, we'll use monthly as fallback since range requires additional parameters
      return eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate)
      });
    default:
      return [selectedDate];
  }
}

export interface ExcelExportOptions {
  data: UserAttendanceData[];
  selectedDate: Date;
  viewType: ViewType;
  userRole: 'worker' | 'admin' | 'superadmin';
  showUserNames?: boolean;
  worksheetName?: string;
}

export async function exportAttendanceMatrixToExcel({
  data,
  selectedDate,
  viewType,
  userRole,
  showUserNames = true,
  worksheetName
}: ExcelExportOptions): Promise<void> {
  try {
    // Dynamic import to reduce bundle size
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = 'Attendance Tracker';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    const dateRange = getDateRange(selectedDate, viewType);
    const finalWorksheetName = worksheetName || `Attendance Matrix - ${viewType.charAt(0).toUpperCase() + viewType.slice(1)}`;
    const worksheet = workbook.addWorksheet(finalWorksheetName);

    // Calculate column count
    const dateColumns = dateRange.length;
    const hasUserColumn = showUserNames && data.length > 1;
    const totalColumns = hasUserColumn ? dateColumns + 1 : dateColumns;

    // Set up columns
    const columns: any[] = [];
    
    if (hasUserColumn) {
      columns.push({
        header: 'Employee',
        key: 'employee',
        width: 20
      });
    }

    dateRange.forEach((date, index) => {
      columns.push({
        header: format(date, 'EEEE (MMM d)'),
        key: `date_${index}`,
        width: 15
      });
    });

    worksheet.columns = columns;

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 40;
    headerRow.font = { bold: true, size: 10 };
    headerRow.alignment = { 
      vertical: 'middle', 
      horizontal: 'center',
      wrapText: true 
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' } // Indigo background
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text

    // Add borders to header
    for (let col = 1; col <= totalColumns; col++) {
      const cell = headerRow.getCell(col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF374151' } },
        left: { style: 'thin', color: { argb: 'FF374151' } },
        bottom: { style: 'thin', color: { argb: 'FF374151' } },
        right: { style: 'thin', color: { argb: 'FF374151' } }
      };
    }

    // Add data rows
    data.forEach((userData, userIndex) => {
      const rowIndex = userIndex + 2; // +2 because Excel is 1-indexed and we have a header row
      const row = worksheet.getRow(rowIndex);
      row.height = 25;

      let colIndex = 1;

      // Add employee name if showing user names
      if (hasUserColumn) {
        const nameCell = row.getCell(colIndex);
        nameCell.value = userData.user.name;
        nameCell.font = { bold: true, size: 10 };
        nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
        nameCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' } // Very light gray
        };
        nameCell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        colIndex++;
      }

      // Add attendance status for each date
      dateRange.forEach((date) => {
        const status = getAttendanceStatus(date, userData.attendances, userData.offDays);
        const statusColors = EXCEL_STATUS_COLORS[status];
        const statusName = STATUS_DISPLAY_NAMES[status];

        const cell = row.getCell(colIndex);
        cell.value = statusName;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { 
          bold: true, 
          size: 9,
          color: { argb: statusColors.font }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: statusColors.fill }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: statusColors.border } },
          left: { style: 'thin', color: { argb: statusColors.border } },
          bottom: { style: 'thin', color: { argb: statusColors.border } },
          right: { style: 'thin', color: { argb: statusColors.border } }
        };

        colIndex++;
      });
    });

    // Add legend section
    const legendStartRow = data.length + 4; // Leave some space after data
    
    // Legend title
    const legendTitleRow = worksheet.getRow(legendStartRow);
    const legendTitleCell = legendTitleRow.getCell(1);
    legendTitleCell.value = 'Legend:';
    legendTitleCell.font = { bold: true, size: 12 };
    legendTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Legend items
    const legendItems = [
      { status: ATTENDANCE_STATUS.MORNING_SHIFT, description: 'Morning Shift (8:00 AM - 5:00 PM)' },
      { status: ATTENDANCE_STATUS.AFTERNOON_SHIFT, description: 'Afternoon Shift (1:00 PM - 10:00 PM)' },
      { status: ATTENDANCE_STATUS.NIGHT_SHIFT, description: 'Night Shift (10:00 PM - 6:00 AM)' },
      { status: ATTENDANCE_STATUS.OFF_DAY, description: 'Off Day' },
      { status: ATTENDANCE_STATUS.ABSENT, description: 'Absent (No Check-in)' }
    ];

    legendItems.forEach((item, index) => {
      const rowIndex = legendStartRow + index + 1;
      const row = worksheet.getRow(rowIndex);
      
      // Status indicator cell
      const statusCell = row.getCell(1);
      const statusColors = EXCEL_STATUS_COLORS[item.status];
      const statusName = STATUS_DISPLAY_NAMES[item.status];
      
      statusCell.value = statusName;
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
      statusCell.font = { 
        bold: true, 
        size: 9,
        color: { argb: statusColors.font }
      };
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusColors.fill }
      };
      statusCell.border = {
        top: { style: 'thin', color: { argb: statusColors.border } },
        left: { style: 'thin', color: { argb: statusColors.border } },
        bottom: { style: 'thin', color: { argb: statusColors.border } },
        right: { style: 'thin', color: { argb: statusColors.border } }
      };

      // Description cell
      const descCell = row.getCell(2);
      descCell.value = item.description;
      descCell.alignment = { vertical: 'middle', horizontal: 'left' };
      descCell.font = { size: 10 };
    });

    // Set column widths for legend
    worksheet.getColumn(1).width = 15; // Status column
    worksheet.getColumn(2).width = 35; // Description column

    // Add summary information
    const summaryStartRow = legendStartRow + legendItems.length + 3;
    
    const summaryTitleRow = worksheet.getRow(summaryStartRow);
    const summaryTitleCell = summaryTitleRow.getCell(1);
    summaryTitleCell.value = 'Export Information:';
    summaryTitleCell.font = { bold: true, size: 12 };

    const summaryInfo = [
      `Export Date: ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`,
      `Period: ${format(dateRange[0], 'MMM dd, yyyy')} - ${format(dateRange[dateRange.length - 1], 'MMM dd, yyyy')}`,
      `View Type: ${viewType.charAt(0).toUpperCase() + viewType.slice(1)}`,
      `User Role: ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`,
      `Total Employees: ${data.length}`,
      `Total Days: ${dateRange.length}`
    ];

    summaryInfo.forEach((info, index) => {
      const rowIndex = summaryStartRow + index + 1;
      const row = worksheet.getRow(rowIndex);
      const cell = row.getCell(1);
      cell.value = info;
      cell.font = { size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    // Generate filename based on user role and date range
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const rolePrefix = userRole === 'worker' ? 'personal' : 
                      userRole === 'admin' ? 'admin' : 'superadmin';
    const filename = `${rolePrefix}-attendance-matrix-${dateStr}-${viewType}.xlsx`;

    // Generate Excel file and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    console.log(`✓ Attendance matrix Excel file generated successfully: ${filename}`);
  } catch (error) {
    console.error('✗ Error generating attendance matrix Excel file:', error);
    throw new Error('Failed to generate Excel file. Please try again.');
  }
}