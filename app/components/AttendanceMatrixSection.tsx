import { useSearchParams } from "react-router";
import { AttendanceMatrix, type UserAttendanceData } from "~/components/AttendanceMatrix";
import { DateRangeSelector, type ViewType } from "~/components/DateRangeSelector";
import type { DateRange } from "~/components/ui/calendar";

interface AttendanceMatrixSectionProps {
  /**
   * Attendance data for all users to display in the matrix
   */
  attendanceData: UserAttendanceData[];
  
  /**
   * Currently selected date for the matrix view
   */
  selectedDate: Date;
  
  /**
   * Currently selected date range for range/weekly/monthly views
   */
  selectedRange?: DateRange;
  
  /**
   * Current view type (daily, weekly, monthly, range)
   */
  viewType: ViewType;
  
  /**
   * Whether to show user names in the matrix
   * @default true
   */
  showUserNames?: boolean;
  
  /**
   * Whether to show export button
   * @default false
   */
  canExport?: boolean;
  
  /**
   * User role for export functionality
   * @default 'worker'
   */
  userRole?: 'worker' | 'admin' | 'superadmin';
  
  /**
   * Custom export handler
   */
  onExport?: () => void;
}

/**
 * AttendanceMatrixSection Component
 * 
 * A self-contained component that combines the DateRangeSelector and AttendanceMatrix
 * components to provide a complete attendance matrix interface with date navigation.
 * 
 * This component handles:
 * - Date range selection and navigation
 * - View type switching (daily/weekly/monthly)
 * - URL search params synchronization
 * - Attendance matrix display
 * 
 * @param attendanceData - Array of user attendance data to display
 * @param selectedDate - Currently selected date for the matrix view
 * @param viewType - Current view type (daily, weekly, monthly)
 * @param showUserNames - Whether to show user names in the matrix (default: true)
 */
export function AttendanceMatrixSection({
  attendanceData,
  selectedDate,
  selectedRange,
  viewType,
  showUserNames = true,
  canExport = false,
  userRole = 'worker',
  onExport
}: AttendanceMatrixSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Handle date change from DateRangeSelector
   * Updates URL search params to maintain state across navigation
   */
  const handleDateChange = (date: Date) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('date', date.toISOString());
    setSearchParams(newSearchParams);
  };

  /**
   * Handle date range change from DateRangeSelector
   * Updates URL search params to maintain state across navigation
   */
  const handleDateRangeChange = (range: DateRange) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (range.from) {
      newSearchParams.set('rangeFrom', range.from.toISOString());
    } else {
      newSearchParams.delete('rangeFrom');
    }
    if (range.to) {
      newSearchParams.set('rangeTo', range.to.toISOString());
    } else {
      newSearchParams.delete('rangeTo');
    }
    setSearchParams(newSearchParams);
  };

  /**
   * Handle view type change from DateRangeSelector
   * Updates URL search params to maintain state across navigation
   */
  const handleViewTypeChange = (newViewType: ViewType) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('view', newViewType);
    setSearchParams(newSearchParams);
  };

  return (
    <div className="space-y-4">
      {/* Date Range Selector */}
      <DateRangeSelector
        selectedDate={selectedDate}
        selectedRange={selectedRange}
        viewType={viewType}
        onDateChange={handleDateChange}
        onDateRangeChange={handleDateRangeChange}
        onViewTypeChange={handleViewTypeChange}
      />
      
      {/* Attendance Matrix */}
      <AttendanceMatrix
        data={attendanceData}
        viewType={viewType}
        selectedDate={selectedDate}
        selectedRange={selectedRange}
        showUserNames={showUserNames}
        canExport={canExport}
        userRole={userRole}
        onExport={onExport}
      />
    </div>
  );
}