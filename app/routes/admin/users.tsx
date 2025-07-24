import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { getUserPrimaryRole } from "~/utils/auth.server";
import { Plus, Edit, Trash2, Shield, User } from "lucide-react";
import type { User as PrismaUser } from "@prisma/client";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  
  const users = await prisma.user.findMany({
    include: {
      roles: true,
    },
    orderBy: { createdAt: "desc" },
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
            View user accounts - Contact superadmin for user management
          </p>
        </div>
        <div className="text-sm text-gray-500 italic">
          Read-Only Access
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users.map((user) => (
            <li key={user.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {user.roles?.some((role: { name: string }) => role.name === "ADMIN" || role.name === "SUPERADMIN") ? (
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
                        @{user.username} • {getUserPrimaryRole(user as PrismaUser & { roles: { name: string }[] })}
                      </div>
                      <div className="mt-1 flex items-center text-xs text-gray-500 space-x-1">
                        {user.roles?.map((role: { id: string; name: string }) => {
                          const roleColor = role.name === "SUPERADMIN"
                            ? "bg-red-100 text-red-800"
                            : role.name === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-green-100 text-green-800";
                          
                          return (
                            <span key={role.id} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleColor}`}>
                              {role.name}
                            </span>
                          );
                        }) || (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            WORKER
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Admin accounts can only view user information - no edit/delete permissions */}
                    <span className="text-xs text-gray-500 italic">
                      View Only - Contact Superadmin for Changes
                    </span>
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Contact superadmin to create user accounts.
          </p>
        </div>
      )}
    </div>
  );
}