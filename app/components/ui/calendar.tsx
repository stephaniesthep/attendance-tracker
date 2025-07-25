import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  onClear?: () => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  showClear?: boolean;
}

export function Calendar({ selected, onSelect, onClear, minDate, maxDate, className = "", showClear = true }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

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
    calendarDays.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      isDisabled: (minDate && date < minDate) || (maxDate && date > maxDate),
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    const isSelected = selected && date.toDateString() === selected.toDateString();
    const isDisabled = (minDate && date < minDate) || (maxDate && date > maxDate);

    calendarDays.push({
      date,
      day,
      isCurrentMonth: true,
      isToday,
      isSelected,
      isDisabled,
    });
  }

  // Next month days to fill the grid (6 rows × 7 days = 42 total)
  const remainingDays = 42 - calendarDays.length;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    calendarDays.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      isDisabled: (minDate && date < minDate) || (maxDate && date > maxDate),
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
    if (!isDisabled) {
      onSelect(date);
    }
  };

  const handleTodayClick = () => {
    const todayDate = new Date();
    const isDisabled = (minDate && todayDate < minDate) || (maxDate && todayDate > maxDate);
    if (!isDisabled) {
      onSelect(todayDate);
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
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((calendarDay, index) => {
          const { date, day, isCurrentMonth, isToday, isSelected, isDisabled } = calendarDay;
          
          return (
            <button
              key={index}
              onClick={() => handleDateClick(date, isDisabled || false)}
              disabled={isDisabled}
              type="button"
              className={`
                h-8 w-8 text-sm rounded-md transition-colors
                ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                ${isToday ? 'bg-blue-100 text-blue-900 font-semibold' : ''}
                ${isSelected ? 'bg-blue-600 text-white font-semibold' : ''}
                ${isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-100'}
                ${!isSelected && !isToday && !isDisabled ? 'hover:bg-gray-100' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

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