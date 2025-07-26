import { useState } from "react";
import { DateRangeSelector, type ViewType } from "~/components/DateRangeSelector";
import { AttendanceMatrix } from "~/components/AttendanceMatrix";
import type { DateRange } from "~/components/ui/calendar";
import { format } from "date-fns";

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
        <h3 className="text-lg font-medium text-gray-900 mb-2">How to Test</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div><strong>Daily Selection:</strong> Select "Daily" view and click on any date in the calendar.</div>
          <div><strong>Range Selection:</strong> Select "Range" view, click a start date, then click an end date.</div>
          <div><strong>Maximum Range:</strong> Try selecting a range longer than 31 days - it should reset to start a new range.</div>
          <div><strong>Navigation:</strong> Use the arrow buttons to navigate between dates/ranges.</div>
        </div>
      </div>

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