import { useSearchParams } from "react-router";
import { AttendanceMatrix, type UserAttendanceData } from "~/components/AttendanceMatrix";
import { DateRangeSelector, type ViewType } from "~/components/DateRangeSelector";

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
   * Current view type (daily, weekly, monthly)
   */
  viewType: ViewType;
  
  /**
   * Whether to show user names in the matrix
   * @default true
   */
  showUserNames?: boolean;
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
  viewType,
  showUserNames = true
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
        viewType={viewType}
        onDateChange={handleDateChange}
        onViewTypeChange={handleViewTypeChange}
      />
      
      {/* Attendance Matrix */}
      <AttendanceMatrix
        data={attendanceData}
        viewType={viewType}
        selectedDate={selectedDate}
        showUserNames={showUserNames}
      />
    </div>
  );
}