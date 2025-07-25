import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Public routes
  route("login", "routes/login.tsx"),
  route("public-photo/:attendanceId/:type", "routes/public-photo.$attendanceId.$type.tsx"),
  
  // Protected routes with layout
  layout("routes/layouts/protected.tsx", [
    index("routes/home.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
    route("attendance", "routes/attendance.tsx"),
    route("profile", "routes/profile.tsx"),
    route("photo/:attendanceId/:type", "routes/photo.$attendanceId.$type.tsx"),
    
    // Admin only routes
    layout("routes/layouts/admin.tsx", [
      route("admin", "routes/admin/index.tsx"),
      route("admin/users", "routes/admin/users.tsx"),
      route("admin/users/new", "routes/admin/users.new.tsx"),
      route("admin/attendance", "routes/admin/attendance.tsx"),
    ]),
    
    // Super Admin only routes
    layout("routes/layouts/superadmin.tsx", [
      route("superadmin", "routes/superadmin/index.tsx"),
      route("superadmin/users", "routes/superadmin/users.tsx"),
      route("superadmin/profile", "routes/superadmin/profile.tsx"),
    ]),
  ]),
  
  // API routes
  route("api/auth/logout", "routes/api/auth.logout.tsx"),
  route("api/attendance/checkin", "routes/api/attendance.checkin.tsx"),
  route("api/attendance/checkout", "routes/api/attendance.checkout.tsx"),
  route("api/photo/:attendanceId/:type", "routes/api/photo.$attendanceId.$type.tsx"),
] satisfies RouteConfig;
