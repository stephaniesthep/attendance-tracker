# Attendance Tracker Application

A web-based attendance tracking system with photo capture, location tracking, and role-based access control.

## Features

- **Photo-based Check-in/Check-out**: Workers can check in and out using their webcam
- **Location Tracking**: Captures GPS coordinates during check-in/check-out
- **Role-based Access**: 
  - **Workers**: Can only access their own attendance records and check-in/out
  - **Admins**: Can manage users, view all attendance records, and export data
- **Daily Attendance Reports**: Admins can view and export daily attendance data
- **User Management**: Admins can create and manage worker accounts
- **Real-time Dashboard**: Shows current status and recent attendance history

## Tech Stack

- **Frontend**: React with React Router v7
- **Styling**: Tailwind CSS v4
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **UI Components**: Shadcn UI with Lucide icons
- **Table**: TanStack React Table
- **Camera**: React Webcam
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd attendance-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

4. Seed the database with test data:
```bash
npm run db:seed
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Test Credentials

After running the seed script, you can use these credentials:

**Admin Account:**
- Username: `admin1`
- Password: `admin123`

**Worker Account:**
- Username: `worker1`
- Password: `worker123`

## Application Structure

### Routes

- `/login` - Login page
- `/dashboard` - Worker/Admin dashboard
- `/attendance` - Check-in/out page with camera
- `/profile` - User profile page
- `/admin` - Admin dashboard (admin only)
- `/admin/users` - User management (admin only)
- `/admin/users/new` - Create new user (admin only)
- `/admin/attendance` - View all attendance records (admin only)

### Database Schema

**User Table:**
- `id` - Unique identifier
- `username` - Login username
- `password` - Hashed password
- `name` - Full name
- `department` - Department/division
- `role` - ADMIN or WORKER

**Attendance Table:**
- `id` - Unique identifier
- `userId` - Reference to User
- `date` - Attendance date
- `checkInTime` - Check-in timestamp
- `checkInPhoto` - Base64 encoded photo
- `checkInLocation` - GPS coordinates (JSON)
- `checkOutTime` - Check-out timestamp (nullable)
- `checkOutPhoto` - Base64 encoded photo (nullable)
- `checkOutLocation` - GPS coordinates (nullable)
- `duration` - Work duration in minutes (nullable)

## Usage Guide

### For Workers

1. **Login**: Use your username and password to login
2. **Check-in**: 
   - Navigate to the Attendance page
   - Click "Open Camera"
   - Allow camera and location permissions
   - Take a photo and click "Check In"
3. **Check-out**: 
   - Return to the Attendance page
   - Take another photo
   - Click "Check Out"
4. **View History**: Check your attendance history on the Dashboard

### For Admins

1. **User Management**:
   - Go to Admin > Manage Users
   - Click "Add User" to create new accounts
   - Set username, password, name, department, and role

2. **View Attendance**:
   - Go to Admin > View Attendance
   - Select a date to view records
   - Use search to filter results
   - Click "Export CSV" to download data

3. **Dashboard Overview**:
   - View total users, today's attendance, and other statistics
   - Access quick actions for common tasks

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Session management with secure cookies
- Role-based route protection
- Input validation and sanitization

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run db:seed` - Seed database with test data

### Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-key-here"
SESSION_SECRET="your-session-secret"
```

## Browser Requirements

- Modern browser with WebRTC support for camera access
- Geolocation API support for location tracking
- JavaScript enabled

## Known Limitations

- Photos are stored as base64 strings in the database (consider using file storage for production)
- Location accuracy depends on device GPS capabilities
- Camera quality depends on device hardware

## Future Enhancements

- [ ] Email notifications for admins
- [ ] Monthly/yearly attendance reports
- [ ] Leave management system
- [ ] Mobile app version
- [ ] Facial recognition for automatic check-in
- [ ] Integration with HR systems
- [ ] Bulk user import/export
- [ ] Attendance analytics and insights

## License

This project is licensed under the MIT License.
