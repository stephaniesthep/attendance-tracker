import { Outlet, Link, useLoaderData, Form } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { getUserWithPermissions } from "~/utils/rbac.server";
import { userHasRole } from "~/utils/auth";
import { LogOut, Home, Camera, Users, User, Shield } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  // Get user with roles for navigation display
  const userWithRoles = await getUserWithPermissions(user.id);
  if (!userWithRoles) {
    throw new Error("User not found");
  }
  
  // Check roles on server side and pass to client
  const isSuperAdmin = userHasRole(userWithRoles, "SUPERADMIN");
  const isAdmin = userHasRole(userWithRoles, "ADMIN");
  const roleNames = userWithRoles.roles?.map((r: { name: string }) => r.name).join(", ") || "WORKER";
  
  return {
    user: {
      id: userWithRoles.id,
      name: userWithRoles.name,
      username: userWithRoles.username,
      department: userWithRoles.department,
      createdAt: userWithRoles.createdAt,
    },
    isSuperAdmin,
    isAdmin,
    roleNames,
  };
}

export default function ProtectedLayout() {
  const { user, isSuperAdmin, isAdmin, roleNames } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold">Attendance Tracker</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Link>
                <Link
                  to="/attendance"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Attendance
                </Link>
                {isSuperAdmin && (
                  <Link
                    to="/superadmin"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Super Admin
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Admin
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {user.name} ({roleNames})
                </span>
                <Form method="post" action="/api/auth/logout">
                  <button
                    type="submit"
                    className="text-gray-500 hover:text-gray-700 flex items-center"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}