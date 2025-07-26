import { useState } from "react";
import { DateRangeSelector, type ViewType } from "~/components/DateRangeSelector";
import { AttendanceMatrix } from "~/components/AttendanceMatrix";
import type { DateRange } from "~/components/ui/calendar";
import { format, differenceInDays } from "date-fns";

// Mock attendance data for testing
const mockAttendanceData = [
  {
    user: {
      id: "1",
      name: "John Doe",
      department: "Engineering"
    },
    attendances: [
      {
        id: "1",
        userId: "1",
        date: format(new Date(), 'yyyy-MM-dd'),
        checkIn: new Date(),
        checkOut: null,
        shift: "morning",
        status: "present"
      }
    ],
    offDays: []
  },
  {
    user: {
      id: "2",
      name: "Jane Smith",
      department: "Marketing"
    },
    attendances: [
      {
        id: "2",
        userId: "2",
        date: format(new Date(), 'yyyy-MM-dd'),
        checkIn: new Date(),
        checkOut: new Date(),
        shift: "afternoon",
        status: "present"
      }
    ],
    offDays: []
  }
];

export function CalendarTest() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [viewType, setViewType] = useState<ViewType>('daily');

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    console.log('Date changed:', format(date, 'yyyy-MM-dd'));
  };

  const handleDateRangeChange = (range: DateRange) => {
    console.log('CalendarTest handleDateRangeChange called with:', range);
    setSelectedRange(range);
    console.log('Range changed:', {
      from: range.from ? format(range.from, 'yyyy-MM-dd') : undefined,
      to: range.to ? format(range.to, 'yyyy-MM-dd') : undefined
    });
  };

  const handleViewTypeChange = (newViewType: ViewType) => {
    setViewType(newViewType);
    console.log('View type changed:', newViewType);
    
    // Reset range when switching away from range mode
    if (newViewType !== 'range') {
      setSelectedRange({ from: undefined, to: undefined });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar Test</h1>
        <p className="text-gray-600">
          Test the enhanced calendar functionality with single date and range selection.
        </p>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector
        selectedDate={selectedDate}
        selectedRange={selectedRange}
        viewType={viewType}
        onDateChange={handleDateChange}
        onDateRangeChange={handleDateRangeChange}
        onViewTypeChange={handleViewTypeChange}
      />

      {/* Current Selection Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-900 mb-2">Current Selection</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">View Type:</span> {viewType}
          </div>
          {viewType === 'range' ? (
            <div>
              <span className="font-medium">Selected Range:</span>{' '}
              {selectedRange.from && selectedRange.to
                ? `${format(selectedRange.from, 'MMM d, yyyy')} - ${format(selectedRange.to, 'MMM d, yyyy')}`
                : selectedRange.from
                ? `${format(selectedRange.from, 'MMM d, yyyy')} - (select end date)`
                : 'No range selected'}
            </div>
          ) : (
            <div>
              <span className="font-medium">Selected Date:</span> {format(selectedDate, 'MMM d, yyyy')}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">How to Test Enhanced Date Selection</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div><strong>Daily Selection:</strong> Select "Daily" view and click on any date in the calendar.</div>
          <div><strong>Weekly Selection:</strong> Select "Weekly" view and click on any date - it will create a 7-day range starting from that date.</div>
          <div><strong>Monthly Selection:</strong> Select "Monthly" view and click on any date - it will create a range based on actual month length (28-31 days).</div>
          <div><strong>Range Selection:</strong> Select "Range" view, click a start date, then click an end date (max 31 days).</div>
          <div><strong>Maximum Range Limit:</strong> Try selecting a range longer than 31 days - it should be truncated to 31 days with an alert.</div>
          <div><strong>Auto-Sync Dropdown:</strong> In "Range" mode, select exactly 7 days - dropdown should auto-switch to "Weekly". Select 28-31 days - should auto-switch to "Monthly".</div>
          <div><strong>Navigation:</strong> Use the arrow buttons to navigate between dates/ranges while maintaining the custom start day.</div>
          <div><strong>Today Button:</strong> Click "Today" to jump to current date with appropriate range for the selected view type.</div>
          <div><strong>Month Length Handling:</strong> Test monthly selection on different months (February, April, etc.) to see variable month lengths.</div>
        </div>
      </div>

      {/* Range Information */}
      {(selectedRange.from || selectedRange.to) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-green-900 mb-2">Range Details</h3>
          <div className="space-y-2 text-sm text-green-800">
            {selectedRange.from && (
              <div><strong>Start Date:</strong> {format(selectedRange.from, 'EEEE, MMMM d, yyyy')}</div>
            )}
            {selectedRange.to && (
              <div><strong>End Date:</strong> {format(selectedRange.to, 'EEEE, MMMM d, yyyy')}</div>
            )}
            {selectedRange.from && selectedRange.to && (
              <>
                <div><strong>Duration:</strong> {differenceInDays(selectedRange.to, selectedRange.from) + 1} days</div>
                <div><strong>Pattern Detection:</strong> {
                  (() => {
                    const days = differenceInDays(selectedRange.to, selectedRange.from) + 1;
                    if (days === 7) return "Weekly pattern (7 days)";
                    if (days >= 28 && days <= 31) return "Monthly pattern (28-31 days)";
                    return "Custom range";
                  })()
                }</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Attendance Matrix */}
      <AttendanceMatrix
        data={mockAttendanceData}
        viewType={viewType}
        selectedDate={selectedDate}
        selectedRange={selectedRange}
        showUserNames={true}
      />
    </div>
  );
}