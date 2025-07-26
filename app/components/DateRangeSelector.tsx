import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Calendar as CalendarComponent, type DateRange } from "~/components/ui/calendar";
import { useState, useRef, useEffect } from "react";

export type ViewType = 'daily' | 'weekly' | 'monthly' | 'range';

// Maximum allowed range in days (1 month)
const MAX_RANGE_DAYS = 31;

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
  
  // Helper function to create weekly range starting from any selected day
  const createWeeklyRange = (startDate: Date): DateRange => {
    const endDate = addDays(startDate, 6); // 7 days total
    return { from: startDate, to: endDate };
  };

  // Helper function to create monthly range starting from any selected day
  const createMonthlyRange = (startDate: Date): DateRange => {
    // Get the actual number of days in the month starting from the selected date
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const daysInMonth = getDaysInMonth(new Date(year, month));
    
    // Calculate how many days from start date to end of month
    const dayOfMonth = startDate.getDate();
    const remainingDaysInMonth = daysInMonth - dayOfMonth;
    
    // If we have enough days in current month for 31 days, use that
    // Otherwise, extend into next month to reach approximately 30-31 days
    let endDate: Date;
    if (remainingDaysInMonth >= 30) {
      endDate = addDays(startDate, 30); // 31 days total
    } else {
      // Extend to get close to a full month (28-31 days based on actual month)
      const targetDays = Math.min(daysInMonth - 1, 30); // Don't exceed 31 days total
      endDate = addDays(startDate, targetDays);
    }
    
    return { from: startDate, to: endDate };
  };

  // Helper function to validate range doesn't exceed maximum
  const validateRange = (range: DateRange): { range: DateRange; wasTruncated: boolean } => {
    if (!range.from || !range.to) return { range, wasTruncated: false };
    
    const daysDiff = differenceInDays(range.to, range.from) + 1;
    if (daysDiff > MAX_RANGE_DAYS) {
      // Truncate to maximum allowed days
      const newTo = addDays(range.from, MAX_RANGE_DAYS - 1);
      return {
        range: { from: range.from, to: newTo },
        wasTruncated: true
      };
    }
    return { range, wasTruncated: false };
  };

  // Helper function to detect range pattern and suggest appropriate view type
  const detectRangePattern = (range: DateRange): ViewType | null => {
    if (!range.from || !range.to) return null;
    
    const daysDiff = differenceInDays(range.to, range.from) + 1;
    
    // Check for weekly pattern (exactly 7 days)
    if (daysDiff === 7) {
      return 'weekly';
    }
    
    // Check for monthly pattern (28-31 days)
    if (daysDiff >= 28 && daysDiff <= 31) {
      return 'monthly';
    }
    
    return null;
  };
  
  const navigatePrevious = () => {
    switch (viewType) {
      case 'daily':
        onDateChange(subDays(selectedDate, 1));
        break;
      case 'weekly':
        // For weekly view, move by 7 days but maintain the custom start day
        if (selectedRange?.from) {
          const newRange = createWeeklyRange(subDays(selectedRange.from, 7));
          onDateRangeChange?.(newRange);
        } else {
          // Fallback to traditional week navigation
          onDateChange(subWeeks(selectedDate, 1));
        }
        break;
      case 'monthly':
        // For monthly view, move by one month but maintain the custom start day
        if (selectedRange?.from) {
          const prevMonth = subMonths(selectedRange.from, 1);
          const newRange = createMonthlyRange(prevMonth);
          onDateRangeChange?.(newRange);
        } else {
          // Fallback to traditional month navigation
          onDateChange(subMonths(selectedDate, 1));
        }
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
        // For weekly view, move by 7 days but maintain the custom start day
        if (selectedRange?.from) {
          const newRange = createWeeklyRange(addDays(selectedRange.from, 7));
          onDateRangeChange?.(newRange);
        } else {
          // Fallback to traditional week navigation
          onDateChange(addWeeks(selectedDate, 1));
        }
        break;
      case 'monthly':
        // For monthly view, move by one month but maintain the custom start day
        if (selectedRange?.from) {
          const nextMonth = addMonths(selectedRange.from, 1);
          const newRange = createMonthlyRange(nextMonth);
          onDateRangeChange?.(newRange);
        } else {
          // Fallback to traditional month navigation
          onDateChange(addMonths(selectedDate, 1));
        }
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
    const today = new Date();
    
    switch (viewType) {
      case 'daily':
        onDateChange(today);
        break;
      case 'weekly':
        // Create weekly range starting from today
        const weeklyRange = createWeeklyRange(today);
        onDateRangeChange?.(weeklyRange);
        break;
      case 'monthly':
        // Create monthly range starting from today
        const monthlyRange = createMonthlyRange(today);
        onDateRangeChange?.(monthlyRange);
        break;
      case 'range':
        onDateRangeChange?.({ from: today, to: undefined });
        break;
      default:
        onDateChange(today);
        break;
    }
  };

  const handleCalendarDateSelect = (date: Date) => {
    // When a single date is selected, automatically create appropriate range based on view type
    switch (viewType) {
      case 'weekly':
        const weeklyRange = createWeeklyRange(date);
        onDateRangeChange?.(weeklyRange);
        break;
      case 'monthly':
        const monthlyRange = createMonthlyRange(date);
        onDateRangeChange?.(monthlyRange);
        break;
      default:
        onDateChange(date);
        break;
    }
    setShowCalendar(false);
  };

  const handleCalendarRangeSelect = (range: DateRange) => {
    console.log('DateRangeSelector received range:', range);
    
    // Validate and potentially truncate the range
    const { range: validatedRange, wasTruncated } = validateRange(range);
    
    // Show warning if range was truncated
    if (wasTruncated) {
      console.warn(`Range truncated to maximum ${MAX_RANGE_DAYS} days`);
      // You could show a toast notification here if you have a toast system
      alert(`Date range was limited to maximum ${MAX_RANGE_DAYS} consecutive days.`);
    }
    
    // Detect if the selected range matches a pattern and suggest view type change
    const detectedPattern = detectRangePattern(validatedRange);
    if (detectedPattern && detectedPattern !== viewType) {
      // Auto-sync dropdown to match the selected range pattern
      console.log(`Auto-switching to ${detectedPattern} view based on selected range`);
      onViewTypeChange(detectedPattern);
    }
    
    onDateRangeChange?.(validatedRange);
    if (validatedRange.from && validatedRange.to) {
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
        // Show custom weekly range if available, otherwise traditional week
        if (selectedRange?.from && selectedRange?.to) {
          const sameYear = selectedRange.from.getFullYear() === selectedRange.to.getFullYear();
          const dayCount = differenceInDays(selectedRange.to, selectedRange.from) + 1;
          const prefix = dayCount === 7 ? 'Week: ' : `${dayCount} days: `;
          if (sameYear) {
            return `${prefix}${format(selectedRange.from, 'MMM d')} – ${format(selectedRange.to, 'MMM d, yyyy')}`;
          } else {
            return `${prefix}${format(selectedRange.from, 'MMM d, yyyy')} – ${format(selectedRange.to, 'MMM d, yyyy')}`;
          }
        } else {
          // Fallback to traditional week display
          const weekStart = subDays(selectedDate, selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1);
          const weekEnd = addDays(weekStart, 6);
          return `Week: ${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
        }
      case 'monthly':
        // Show custom monthly range if available, otherwise traditional month
        if (selectedRange?.from && selectedRange?.to) {
          const sameYear = selectedRange.from.getFullYear() === selectedRange.to.getFullYear();
          const dayCount = differenceInDays(selectedRange.to, selectedRange.from) + 1;
          const prefix = dayCount >= 28 && dayCount <= 31 ? 'Month: ' : `${dayCount} days: `;
          if (sameYear) {
            return `${prefix}${format(selectedRange.from, 'MMM d')} – ${format(selectedRange.to, 'MMM d, yyyy')}`;
          } else {
            return `${prefix}${format(selectedRange.from, 'MMM d, yyyy')} – ${format(selectedRange.to, 'MMM d, yyyy')}`;
          }
        } else {
          // Fallback to traditional month display
          return `Month: ${format(selectedDate, 'MMMM yyyy')}`;
        }
      case 'range':
        if (selectedRange?.from && selectedRange?.to) {
          // Check if both dates are in the same year
          const sameYear = selectedRange.from.getFullYear() === selectedRange.to.getFullYear();
          const dayCount = differenceInDays(selectedRange.to, selectedRange.from) + 1;
          const prefix = `Range (${dayCount} days): `;
          if (sameYear) {
            return `${prefix}${format(selectedRange.from, 'MMM d')} – ${format(selectedRange.to, 'MMM d, yyyy')}`;
          } else {
            return `${prefix}${format(selectedRange.from, 'MMM d, yyyy')} – ${format(selectedRange.to, 'MMM d, yyyy')}`;
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
                  mode={viewType === 'range' || viewType === 'weekly' || viewType === 'monthly' ? 'range' : 'single'}
                  selected={viewType === 'daily' ? selectedDate : undefined}
                  selectedRange={viewType !== 'daily' ? selectedRange : undefined}
                  onSelect={viewType === 'daily' ? handleCalendarDateSelect : handleCalendarDateSelect}
                  onSelectRange={viewType !== 'daily' ? handleCalendarRangeSelect : undefined}
                  maxRangeDays={MAX_RANGE_DAYS}
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