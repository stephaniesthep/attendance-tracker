import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { differenceInDays, addDays, isSameDay, isWithinInterval, isBefore, isAfter, format } from "date-fns";

export interface DateRange {
  from?: Date;
  to?: Date;
}

interface CalendarProps {
  selected?: Date;
  selectedRange?: DateRange;
  onSelect?: (date: Date) => void;
  onSelectRange?: (range: DateRange) => void;
  onClear?: () => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  showClear?: boolean;
  mode?: 'single' | 'range';
  maxRangeDays?: number;
}

export function Calendar({
  selected,
  selectedRange,
  onSelect,
  onSelectRange,
  onClear,
  minDate,
  maxDate,
  className = "",
  showClear = true,
  mode = 'single',
  maxRangeDays = 31
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Helper functions for range selection
  const isDateInRange = (date: Date): boolean => {
    if (mode !== 'range' || !selectedRange?.from) return false;
    
    if (selectedRange.to) {
      return isWithinInterval(date, { start: selectedRange.from, end: selectedRange.to });
    } else {
      return isSameDay(date, selectedRange.from);
    }
  };

  const isDateRangeStart = (date: Date): boolean => {
    return mode === 'range' && selectedRange?.from ? isSameDay(date, selectedRange.from) : false;
  };

  const isDateRangeEnd = (date: Date): boolean => {
    return mode === 'range' && selectedRange?.to ? isSameDay(date, selectedRange.to) : false;
  };

  // Helper function to check if date is in hover preview range
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  
  const isDateInHoverRange = (date: Date): boolean => {
    if (mode !== 'range' || !selectedRange?.from || selectedRange.to || !hoverDate) return false;
    
    const start = selectedRange.from;
    const end = hoverDate;
    
    if (isBefore(end, start)) {
      return isWithinInterval(date, { start: end, end: start });
    } else {
      return isWithinInterval(date, { start, end });
    }
  };

  const isHoverRangeValid = (date: Date): boolean => {
    if (!selectedRange?.from || !date) return true;
    
    const start = selectedRange.from;
    const end = date;
    const daysDiff = Math.abs(differenceInDays(end, start)) + 1;
    
    return daysDiff <= maxRangeDays;
  };

  // Get first day of the month and how many days in the month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Get days from previous month to fill the grid
  const daysFromPrevMonth = startingDayOfWeek;
  const prevMonth = new Date(year, month - 1, 0);
  const daysInPrevMonth = prevMonth.getDate();

  // Generate calendar days
  const calendarDays = [];

  // Previous month days
  for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = new Date(year, month - 1, day);
    const inRange = isDateInRange(date);
    const inHoverRange = isDateInHoverRange(date);
    const isRangeStart = isDateRangeStart(date);
    const isRangeEnd = isDateRangeEnd(date);
    
    calendarDays.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      isDisabled: (minDate && date < minDate) || (maxDate && date > maxDate),
      inRange,
      inHoverRange,
      isRangeStart,
      isRangeEnd,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    const isSelected = mode === 'single' && selected && date.toDateString() === selected.toDateString();
    const isDisabled = (minDate && date < minDate) || (maxDate && date > maxDate);
    const inRange = isDateInRange(date);
    const inHoverRange = isDateInHoverRange(date);
    const isRangeStart = isDateRangeStart(date);
    const isRangeEnd = isDateRangeEnd(date);

    calendarDays.push({
      date,
      day,
      isCurrentMonth: true,
      isToday,
      isSelected,
      isDisabled,
      inRange,
      inHoverRange,
      isRangeStart,
      isRangeEnd,
    });
  }

  // Next month days to fill the grid (6 rows × 7 days = 42 total)
  const remainingDays = 42 - calendarDays.length;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    const inRange = isDateInRange(date);
    const inHoverRange = isDateInHoverRange(date);
    const isRangeStart = isDateRangeStart(date);
    const isRangeEnd = isDateRangeEnd(date);
    
    calendarDays.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      isDisabled: (minDate && date < minDate) || (maxDate && date > maxDate),
      inRange,
      inHoverRange,
      isRangeStart,
      isRangeEnd,
    });
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDateClick = (date: Date, isDisabled: boolean) => {
    if (isDisabled) return;

    console.log('Calendar date clicked:', { date, mode, selectedRange });

    if (mode === 'single') {
      onSelect?.(date);
    } else if (mode === 'range' && onSelectRange) {
      if (!selectedRange?.from || (selectedRange.from && selectedRange.to)) {
        // Start new range
        console.log('Starting new range with:', date);
        onSelectRange({ from: date, to: undefined });
        setHoverDate(null);
      } else if (selectedRange.from && !selectedRange.to) {
        // Complete range
        const from = selectedRange.from;
        const to = date;
        
        // Ensure from is before to
        const startDate = from <= to ? from : to;
        const endDate = from <= to ? to : from;
        
        // Check if range exceeds maximum days
        const daysDiff = differenceInDays(endDate, startDate) + 1;
        console.log('Completing range:', { from: startDate, to: endDate, daysDiff, maxRangeDays });
        
        if (daysDiff > maxRangeDays) {
          // If exceeds max, start new range from clicked date
          console.log('Range exceeds max days, starting new range');
          onSelectRange({ from: date, to: undefined });
        } else {
          console.log('Range is valid, setting complete range');
          onSelectRange({ from: startDate, to: endDate });
        }
        setHoverDate(null);
      }
    }
  };

  const handleDateHover = (date: Date, isDisabled: boolean) => {
    if (isDisabled || mode !== 'range' || !selectedRange?.from || selectedRange.to) {
      setHoverDate(null);
      return;
    }
    
    setHoverDate(date);
  };

  const handleDateLeave = () => {
    if (mode === 'range' && selectedRange?.from && !selectedRange?.to) {
      // Keep hover state when moving between dates during range selection
      return;
    }
    setHoverDate(null);
  };

  const handleTodayClick = () => {
    const todayDate = new Date();
    const isDisabled = (minDate && todayDate < minDate) || (maxDate && todayDate > maxDate);
    if (!isDisabled) {
      if (mode === 'single') {
        onSelect?.(todayDate);
      } else if (mode === 'range' && onSelectRange) {
        onSelectRange({ from: todayDate, to: undefined });
      }
    }
  };


  const handleClearClick = () => {
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-gray-900">
          {monthNames[month]} {year}
        </h2>
        <button
          onClick={goToNextMonth}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((dayName) => (
          <div key={dayName} className="text-center text-xs font-medium text-gray-500 py-2">
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1" onMouseLeave={handleDateLeave}>
        {calendarDays.map((calendarDay, index) => {
          const { date, day, isCurrentMonth, isToday, isSelected, isDisabled, inRange, inHoverRange, isRangeStart, isRangeEnd } = calendarDay;
          
          // Enhanced styling logic for better range visualization
          const isHoverValid = isHoverRangeValid(date);
          const showHoverPreview = inHoverRange && isHoverValid;
          const showInvalidHover = inHoverRange && !isHoverValid;
          
          // Determine if this date is at the start or end of a visual range (including hover)
          const isVisualRangeStart = isRangeStart || (showHoverPreview && selectedRange?.from && isSameDay(date, selectedRange.from));
          const isVisualRangeEnd = isRangeEnd || (showHoverPreview && hoverDate && isSameDay(date, hoverDate));
          
          return (
            <button
              key={index}
              onClick={() => handleDateClick(date, isDisabled || false)}
              onMouseEnter={() => handleDateHover(date, isDisabled || false)}
              disabled={isDisabled}
              type="button"
              className={`
                h-8 w-8 text-sm transition-all duration-150 relative
                ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                ${isToday && !isSelected && !isRangeStart && !isRangeEnd && !inRange && !showHoverPreview ? 'bg-blue-100 text-blue-900 font-semibold rounded-md border border-blue-300' : ''}
                ${isSelected ? 'bg-blue-600 text-white font-semibold rounded-md' : ''}
                ${isRangeStart && !isRangeEnd ? 'bg-blue-600 text-white font-semibold' : ''}
                ${isRangeStart && isRangeEnd ? 'bg-blue-600 text-white font-semibold rounded-md' : ''}
                ${isRangeStart && selectedRange?.to ? 'rounded-l-md' : isRangeStart ? 'rounded-md' : ''}
                ${isRangeEnd && !isRangeStart ? 'bg-blue-600 text-white font-semibold rounded-r-md' : ''}
                ${inRange && !isRangeStart && !isRangeEnd ? 'bg-blue-200 text-blue-900 font-medium' : ''}
                ${showHoverPreview && !inRange && !isRangeStart && !isRangeEnd ? 'bg-blue-100 text-blue-800 font-medium border border-blue-200' : ''}
                ${showInvalidHover ? 'bg-red-100 text-red-800 border border-red-200' : ''}
                ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}
                ${!isSelected && !isToday && !isDisabled && !inRange && !isRangeStart && !isRangeEnd && !showHoverPreview && !showInvalidHover ? 'hover:bg-gray-100 hover:scale-105' : ''}
                ${inRange && !isRangeStart && !isRangeEnd ? 'rounded-none' : ''}
                ${showHoverPreview && !isVisualRangeStart && !isVisualRangeEnd ? 'rounded-none' : ''}
                ${!inRange && !showHoverPreview && !isSelected && !isToday && !isRangeStart && !isRangeEnd ? 'rounded-md' : ''}
              `}
            >
              {day}
              {showInvalidHover && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                  !
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Range selection info */}
      {mode === 'range' && selectedRange?.from && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-xs text-blue-800">
            {selectedRange.to ? (
              <div className="flex justify-between items-center">
                <span>Selected: {differenceInDays(selectedRange.to, selectedRange.from) + 1} days</span>
                <span className="text-blue-600">
                  {format(selectedRange.from, 'MMM d')} - {format(selectedRange.to, 'MMM d')}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span>Start: {format(selectedRange.from, 'MMM d, yyyy')}</span>
                <span className="text-blue-600">Select end date</span>
              </div>
            )}
          </div>
          {hoverDate && selectedRange.from && !selectedRange.to && (
            <div className="text-xs text-gray-600 mt-1">
              {isHoverRangeValid(hoverDate) ? (
                <span>Preview: {Math.abs(differenceInDays(hoverDate, selectedRange.from)) + 1} days</span>
              ) : (
                <span className="text-red-600">
                  Exceeds {maxRangeDays} day limit ({Math.abs(differenceInDays(hoverDate, selectedRange.from)) + 1} days)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
        {showClear && onClear && (
          <button
            onClick={handleClearClick}
            type="button"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Clear
          </button>
        )}
        {!showClear && <div></div>}
        <button
          onClick={handleTodayClick}
          type="button"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          Today
        </button>
      </div>
    </div>
  );
}