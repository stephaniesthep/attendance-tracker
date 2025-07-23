import { Outlet, Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireSuperAdmin } from "~/utils/session.server";
import {
  Users,
  User,
  Shield,
  LogOut,
  BarChart3,
  Settings,
  Crown,
  ChevronDown
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireSuperAdmin(request);
  return { user };
}

export default function SuperAdminLayout() {
  const { user } = useLoaderData<typeof loader>();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigation = [
    { name: "Dashboard", href: "/superadmin", icon: Settings },
    { name: "User Management", href: "/superadmin/users", icon: Users },
    { name: "Attendance Reports", href: "/admin/attendance", icon: BarChart3 },
    { name: "Super Admin Panel", href: "/admin", icon: Shield },
    { name: "Profile Settings", href: "/superadmin/profile", icon: User },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-red-600 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Crown className="h-8 w-8 text-white mr-3" />
              <h1 className="text-xl font-semibold text-white">
                Super Admin Panel
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 text-white hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-600 rounded-md px-3 py-2"
                >
                  <Shield className="h-5 w-5" />
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs bg-red-700 px-2 py-1 rounded-full">
                    SUPERADMIN
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
                    <Link
                      to="/superadmin"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Dashboard
                    </Link>
                    <Link
                      to="/admin/attendance"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Attendance Reports
                    </Link>
                    <Link
                      to="/superadmin"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Super Admin
                    </Link>
                    <Link
                      to="/superadmin/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Profile Settings
                    </Link>
                    <hr className="my-1" />
                    <Link
                      to="/api/auth/logout"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 mr-8">
            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 group"
                  >
                    <Icon className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-500" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Warning Notice */}
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">
                    Super Admin Access
                  </h3>
                  <p className="mt-1 text-xs text-yellow-700">
                    You have full system access. Use these privileges responsibly.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}