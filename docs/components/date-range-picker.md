# Enhanced Date Range Picker Documentation

## Overview

The Enhanced Date Range Picker for the Attendance Matrix provides comprehensive date selection functionality with support for multi-day, weekly, monthly, and custom range selections. It includes intelligent dropdown synchronization, visual feedback, and range validation.

## Features

### 1. Multi-day Selection
- Users can select custom date ranges by choosing start and end dates
- Maximum range limit of 31 consecutive days
- Visual feedback during selection process

### 2. Weekly Range Selection
- 7-day ranges starting from any day of the week (not fixed to Monday/Sunday)
- Flexible weekly periods that can start on any date
- Navigation maintains custom start day

### 3. Monthly Range Selection
- Variable month length handling (28, 29, 30, or 31 days)
- Intelligent calculation based on actual month boundaries
- Accounts for leap years and different month lengths

### 4. Range Limits
- All selections restricted to maximum 31 consecutive days
- Real-time validation with user feedback
- Visual indicators for invalid ranges

### 5. Dropdown Sync Behavior
- Automatic detection of range patterns
- Auto-switches to "Weekly" for exactly 7-day ranges
- Auto-switches to "Monthly" for 28-31 day ranges
- Seamless user experience

## Components

### DateRangeSelector
Main component that handles date range selection and view type management.

**Props:**
- `selectedDate: Date` - Currently selected single date
- `selectedRange?: DateRange` - Currently selected date range
- `viewType: ViewType` - Current view type ('daily' | 'weekly' | 'monthly' | 'range')
- `onDateChange: (date: Date) => void` - Single date change handler
- `onDateRangeChange?: (range: DateRange) => void` - Range change handler
- `onViewTypeChange: (viewType: ViewType) => void` - View type change handler

### Calendar (Enhanced UI)
Enhanced calendar component with hotel/flight booking-style range selection.

**New Features:**
- Hover preview for range selection
- Visual highlighting of date ranges
- Invalid range indicators
- Real-time range validation feedback
- Smooth transitions and animations

## Usage Examples

### Basic Implementation
```tsx
import { DateRangeSelector } from "~/components/DateRangeSelector";

function AttendanceView() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange>({});
  const [viewType, setViewType] = useState<ViewType>('daily');

  return (
    <DateRangeSelector
      selectedDate={selectedDate}
      selectedRange={selectedRange}
      viewType={viewType}
      onDateChange={setSelectedDate}
      onDateRangeChange={setSelectedRange}
      onViewTypeChange={setViewType}
    />
  );
}
```

### With AttendanceMatrix Integration
```tsx
import { AttendanceMatrixSection } from "~/components/AttendanceMatrixSection";

function AttendancePage() {
  return (
    <AttendanceMatrixSection
      attendanceData={data}
      selectedDate={selectedDate}
      selectedRange={selectedRange}
      viewType={viewType}
      showUserNames={true}
      canExport={true}
      userRole="admin"
    />
  );
}
```

## Technical Implementation

### Range Pattern Detection
The system automatically detects when manually selected ranges match common patterns:

```typescript
const detectRangePattern = (range: DateRange): ViewType | null => {
  if (!range.from || !range.to) return null;
  
  const daysDiff = differenceInDays(range.to, range.from) + 1;
  
  // Weekly pattern (exactly 7 days)
  if (daysDiff === 7) return 'weekly';
  
  // Monthly pattern (28-31 days)
  if (daysDiff >= 28 && daysDiff <= 31) return 'monthly';
  
  return null;
};
```

### Monthly Range Calculation
Intelligent monthly range calculation that accounts for variable month lengths:

```typescript
const createMonthlyRange = (startDate: Date): DateRange => {
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = getDaysInMonth(new Date(year, month));
  
  const dayOfMonth = startDate.getDate();
  const remainingDaysInMonth = daysInMonth - dayOfMonth;
  
  let endDate: Date;
  if (remainingDaysInMonth >= 30) {
    endDate = addDays(startDate, 30); // 31 days total
  } else {
    const targetDays = Math.min(daysInMonth - 1, 30);
    endDate = addDays(startDate, targetDays);
  }
  
  return { from: startDate, to: endDate };
};
```

### Range Validation
Comprehensive range validation with user feedback:

```typescript
const validateRange = (range: DateRange): { range: DateRange; wasTruncated: boolean } => {
  if (!range.from || !range.to) return { range, wasTruncated: false };
  
  const daysDiff = differenceInDays(range.to, range.from) + 1;
  if (daysDiff > MAX_RANGE_DAYS) {
    const newTo = addDays(range.from, MAX_RANGE_DAYS - 1);
    return { 
      range: { from: range.from, to: newTo }, 
      wasTruncated: true 
    };
  }
  return { range, wasTruncated: false };
};
```

## Visual Enhancements

### Calendar UI Improvements
- **Hover Preview**: Shows range preview while selecting end date
- **Invalid Range Indicators**: Red highlighting for ranges exceeding limits
- **Smooth Transitions**: Enhanced animations for better user experience
- **Range Continuity**: Proper border radius handling for connected date ranges
- **Real-time Feedback**: Live day count and validation messages

### Color Coding
- **Blue**: Selected dates and valid ranges
- **Light Blue**: Hover preview for valid ranges
- **Red**: Invalid ranges or limit exceeded
- **Gray**: Disabled or out-of-range dates

## Testing

Use the calendar test page at `/calendar-test` to validate functionality:

1. **Weekly Selection**: Select "Weekly" and click any date - creates 7-day range
2. **Monthly Selection**: Select "Monthly" and test different months for variable lengths
3. **Range Validation**: Try selecting ranges > 31 days to test truncation
4. **Auto-Sync**: In "Range" mode, select exactly 7 days or 28-31 days to test auto-switching
5. **Navigation**: Use arrow buttons to test range navigation
6. **Hover Feedback**: Test hover preview and invalid range indicators

## Browser Compatibility

- Modern browsers with ES6+ support
- CSS Grid and Flexbox support required
- Touch device support for mobile interfaces

## Performance Considerations

- Efficient date calculations using date-fns library
- Minimal re-renders through proper state management
- Optimized hover handling to prevent excessive updates
- Lazy loading of complex date calculations

## Future Enhancements

- Keyboard navigation support
- Accessibility improvements (ARIA labels, screen reader support)
- Custom range presets (Last 7 days, Last 30 days, etc.)
- Time zone support for global applications
- Integration with external calendar systems