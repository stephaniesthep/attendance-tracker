import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, differenceInDays } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Calendar as CalendarComponent, type DateRange } from "~/components/ui/calendar";
import { useState, useRef, useEffect } from "react";

export type ViewType = 'daily' | 'weekly' | 'monthly' | 'range';

interface DateRangeSelectorProps {
  selectedDate: Date;
  selectedRange?: DateRange;
  viewType: ViewType;
  onDateChange: (date: Date) => void;
  onDateRangeChange?: (range: DateRange) => void;
  onViewTypeChange: (viewType: ViewType) => void;
}

export function DateRangeSelector({
  selectedDate,
  selectedRange,
  viewType,
  onDateChange,
  onDateRangeChange,
  onViewTypeChange
}: DateRangeSelectorProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);
  
  const navigatePrevious = () => {
    switch (viewType) {
      case 'daily':
        onDateChange(subDays(selectedDate, 1));
        break;
      case 'weekly':
        onDateChange(subWeeks(selectedDate, 1));
        break;
      case 'monthly':
        onDateChange(subMonths(selectedDate, 1));
        break;
      case 'range':
        if (selectedRange?.from) {
          const daysDiff = selectedRange.to ? differenceInDays(selectedRange.to, selectedRange.from) : 0;
          const newFrom = subDays(selectedRange.from, daysDiff + 1);
          const newTo = selectedRange.to ? subDays(selectedRange.to, daysDiff + 1) : undefined;
          onDateRangeChange?.({ from: newFrom, to: newTo });
        } else {
          onDateChange(subDays(selectedDate, 1));
        }
        break;
    }
  };

  const navigateNext = () => {
    switch (viewType) {
      case 'daily':
        onDateChange(addDays(selectedDate, 1));
        break;
      case 'weekly':
        onDateChange(addWeeks(selectedDate, 1));
        break;
      case 'monthly':
        onDateChange(addMonths(selectedDate, 1));
        break;
      case 'range':
        if (selectedRange?.from) {
          const daysDiff = selectedRange.to ? differenceInDays(selectedRange.to, selectedRange.from) : 0;
          const newFrom = addDays(selectedRange.from, daysDiff + 1);
          const newTo = selectedRange.to ? addDays(selectedRange.to, daysDiff + 1) : undefined;
          onDateRangeChange?.({ from: newFrom, to: newTo });
        } else {
          onDateChange(addDays(selectedDate, 1));
        }
        break;
    }
  };

  const goToToday = () => {
    if (viewType === 'range') {
      onDateRangeChange?.({ from: new Date(), to: undefined });
    } else {
      onDateChange(new Date());
      onViewTypeChange('daily');
    }
  };

  const handleCalendarDateSelect = (date: Date) => {
    onDateChange(date);
    setShowCalendar(false);
  };

  const handleCalendarRangeSelect = (range: DateRange) => {
    console.log('DateRangeSelector received range:', range);
    onDateRangeChange?.(range);
    if (range.from && range.to) {
      setShowCalendar(false);
    }
  };

  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
  };

  const getDisplayText = () => {
    switch (viewType) {
      case 'daily':
        return format(selectedDate, 'EEEE, MMMM d, yyyy');
      case 'weekly':
        const weekStart = subDays(selectedDate, selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1);
        const weekEnd = addDays(weekStart, 6);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'monthly':
        return format(selectedDate, 'MMMM yyyy');
      case 'range':
        if (selectedRange?.from && selectedRange?.to) {
          // Check if both dates are in the same year
          const sameYear = selectedRange.from.getFullYear() === selectedRange.to.getFullYear();
          if (sameYear) {
            return `${format(selectedRange.from, 'MMM d')} – ${format(selectedRange.to, 'MMM d, yyyy')}`;
          } else {
            return `${format(selectedRange.from, 'MMM d, yyyy')} – ${format(selectedRange.to, 'MMM d, yyyy')}`;
          }
        } else if (selectedRange?.from) {
          return `${format(selectedRange.from, 'MMM d, yyyy')} – Select end date`;
        } else {
          return 'Select date range';
        }
      default:
        return format(selectedDate, 'MMMM yyyy');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* View Type Selector */}
        <div className="flex items-center gap-2">
          <Select value={viewType} onValueChange={(value: ViewType) => onViewTypeChange(value)}>
            <SelectTrigger className="w-32 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="range">Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={navigatePrevious}
            className="p-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="relative" ref={calendarRef}>
            <button
              onClick={toggleCalendar}
              className="flex items-center gap-2 w-64 px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <span className="truncate text-left flex-1">
                {getDisplayText()}
              </span>
            </button>
            
            {showCalendar && (
              <div className="absolute top-full left-0 mt-2 z-50 w-80">
                <CalendarComponent
                  mode={viewType === 'range' ? 'range' : 'single'}
                  selected={viewType !== 'range' ? selectedDate : undefined}
                  selectedRange={viewType === 'range' ? selectedRange : undefined}
                  onSelect={viewType !== 'range' ? handleCalendarDateSelect : undefined}
                  onSelectRange={viewType === 'range' ? handleCalendarRangeSelect : undefined}
                  maxRangeDays={31}
                  showClear={false}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={navigateNext}
            className="p-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Today Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          Today
        </Button>
      </div>
    </div>
  );
}