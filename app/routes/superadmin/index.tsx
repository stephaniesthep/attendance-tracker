import { Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireSuperAdmin } from "~/utils/session.server";
import {
  Users,
  Shield,
  User
} from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireSuperAdmin(request);
  return { user };
}

export default function SuperAdminIndex() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
          <Shield className="h-6 w-6 mr-2" />
          Super Admin
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose a section to manage
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Management */}
        <Link
          to="/superadmin/users"
          className="group relative bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div>
            <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-600 ring-4 ring-white">
              <Users className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-8">
            <h3 className="text-lg font-medium">
              <span className="absolute inset-0" aria-hidden="true" />
              User Management
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Manage users, roles, permissions, and system access
            </p>
          </div>
          <span
            className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
            aria-hidden="true"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="m11.293 17.293 1.414 1.414L19.414 12l-6.707-6.707-1.414 1.414L15.586 11H6v2h9.586l-4.293 4.293z" />
            </svg>
          </span>
        </Link>

        {/* Profile Management */}
        <Link
          to="/superadmin/profile"
          className="group relative bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div>
            <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-600 ring-4 ring-white">
              <User className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-8">
            <h3 className="text-lg font-medium">
              <span className="absolute inset-0" aria-hidden="true" />
              Profile Settings
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Manage your super admin profile and account settings
            </p>
          </div>
          <span
            className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
            aria-hidden="true"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="m11.293 17.293 1.414 1.414L19.414 12l-6.707-6.707-1.414 1.414L15.586 11H6v2h9.586l-4.293 4.293z" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}