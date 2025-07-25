import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Eye } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

export type ViewType = 'daily' | 'weekly' | 'monthly';

interface DateRangeSelectorProps {
  selectedDate: Date;
  viewType: ViewType;
  onDateChange: (date: Date) => void;
  onViewTypeChange: (viewType: ViewType) => void;
}

export function DateRangeSelector({
  selectedDate,
  viewType,
  onDateChange,
  onViewTypeChange
}: DateRangeSelectorProps) {
  
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
    }
  };

  const goToToday = () => {
    onDateChange(new Date());
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
      default:
        return format(selectedDate, 'MMMM yyyy');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* View Type Selector */}
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-gray-500" />
          <Select value={viewType} onValueChange={(value: ViewType) => onViewTypeChange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
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
          
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900 truncate">
              {getDisplayText()}
            </span>
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