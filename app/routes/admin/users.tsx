import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { Plus, Edit, Trash2, Shield, User } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      department: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          attendances: true,
        },
      },
    },
  });

  return { users };
}

export default function AdminUsers() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage worker and admin accounts
          </p>
        </div>
        <Link
          to="/admin/users/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users.map((user) => (
            <li key={user.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {user.role === "ADMIN" ? (
                        <Shield className="h-10 w-10 text-purple-500" />
                      ) : (
                        <User className="h-10 w-10 text-gray-400" />
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{user.username} • {user.department}
                      </div>
                      <div className="mt-1 flex items-center text-xs text-gray-500">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.role === "ADMIN" 
                            ? "bg-purple-100 text-purple-800" 
                            : "bg-green-100 text-green-800"
                        }`}>
                          {user.role}
                        </span>
                        <span className="ml-2">
                          • {user._count.attendances} attendance records
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Edit user"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-900"
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No users</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new user.
          </p>
          <div className="mt-6">
            <Link
              to="/admin/users/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}