import { useLoaderData, Form, Link } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { prisma } from "~/utils/db.server";
import { createUser, updateUser, deleteUser, getAllRoles } from "~/utils/auth.server";
import { getUserPrimaryRole } from "~/utils/auth";
import { superAdminOnly } from "~/utils/middleware.server";
import { Users, Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export const loader = superAdminOnly(async ({ user }) => {
  // Get all users with their roles
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          permissions: true,
        },
      },
    },
    orderBy: [
      { name: "asc" }
    ],
  });

  // Get all available roles for the create/edit forms
  const roles = await getAllRoles();

  return { users, roles, currentUser: user };
});

export const action = superAdminOnly(async ({ request, user }) => {
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "delete") {
    const userId = formData.get("userId") as string;
    
    // Prevent deletion of current user
    if (userId === user.id) {
      throw new Error("Cannot delete your own account");
    }
    
    await deleteUser(userId);
    return redirect("/superadmin/users");
  }

  if (action === "create") {
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;
    const department = formData.get("department") as string;
    const roleIds = formData.getAll("roleIds") as string[];

    await createUser({
      username,
      password,
      name,
      department: department || undefined,
      roleIds,
    });

    return redirect("/superadmin/users");
  }

  if (action === "update") {
    const userId = formData.get("userId") as string;
    const username = formData.get("username") as string;
    const name = formData.get("name") as string;
    const department = formData.get("department") as string;
    const roleIds = formData.getAll("roleIds") as string[];
    const password = formData.get("password") as string;

    await updateUser(userId, {
      username,
      name,
      department: department || undefined,
      password: password || undefined,
      roleIds,
    });

    return redirect("/superadmin/users");
  }

  return null;
});

export default function SuperAdminUsers() {
  const { users, roles, currentUser } = useLoaderData<typeof loader>();
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };


  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case "SUPERADMIN":
        return "bg-red-100 text-red-800";
      case "ADMIN":
        return "bg-blue-100 text-blue-800";
      case "WORKER":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPasswordDisplay = (user: { roles: { name: string }[] }) => {
    // For demo purposes, show default passwords based on role
    const primaryRole = getUserPrimaryRole(user);
    switch (primaryRole) {
      case "SUPERADMIN":
        return "superadmin123";
      case "ADMIN":
        return "admin123";
      case "WORKER":
        return "worker123";
      default:
        return "[Encrypted]";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Users className="h-6 w-6 mr-2" />
            User Management
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage all user accounts, roles, and permissions
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create User
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
            <Form method="post" className="space-y-4">
              <input type="hidden" name="action" value="create" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input
                    type="text"
                    name="username"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    name="password"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <input
                    type="text"
                    name="department"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Roles</label>
                  <div className="mt-2 space-y-2">
                    {roles.map((role: { id: string; displayName: string; description: string }) => (
                      <label key={role.id} className="flex items-center">
                        <input
                          type="checkbox"
                          name="roleIds"
                          value={role.id}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {role.displayName} - {role.description}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Create User
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users.map((user: { id: string; username: string; name: string; department: string | null; roles: { id: string; name: string; displayName: string }[] }) => (
            <li key={user.id} className="px-6 py-4">
              {editingUser === user.id ? (
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="action" value="update" />
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username</label>
                      <input
                        type="text"
                        name="username"
                        defaultValue={user.username}
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">New Password (leave blank to keep current)</label>
                      <input
                        type="password"
                        name="password"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        defaultValue={user.name}
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Department</label>
                      <input
                        type="text"
                        name="department"
                        defaultValue={user.department || ""}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Roles</label>
                      <div className="mt-2 space-y-2">
                        {roles.map((role: { id: string; displayName: string; description: string }) => (
                          <label key={role.id} className="flex items-center">
                            <input
                              type="checkbox"
                              name="roleIds"
                              value={role.id}
                              defaultChecked={user.roles.some((userRole: { id: string }) => userRole.id === role.id)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              {role.displayName} - {role.description}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Update User
                    </button>
                  </div>
                </Form>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(getUserPrimaryRole(user))}`}>
                          {getUserPrimaryRole(user)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          @{user.username} • {user.department || 'No Department'} • {user.roles.length} role(s)
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {user.roles.map((role: { id: string; displayName: string }) => (
                            <span key={role.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {role.displayName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">Password:</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-sm font-mono">
                          {showPasswords[user.id] ? getPasswordDisplay(user) : "••••••••"}
                        </span>
                        <button
                          onClick={() => togglePasswordVisibility(user.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords[user.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingUser(user.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {user.id !== currentUser.id && (
                        <Form method="post" className="inline">
                          <input type="hidden" name="action" value="delete" />
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            onClick={(e) => {
                              if (!confirm("Are you sure you want to delete this user?")) {
                                e.preventDefault();
                              }
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </Form>
                      )}
                      {user.id === currentUser.id && (
                        <span className="text-xs text-gray-500 italic">
                          Current User
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}