import { useLoaderData, Form, Link } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireSuperAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { redirect } from "react-router";
import bcrypt from "bcryptjs";
import { Users, Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperAdmin(request);
  
  const users = await prisma.user.findMany({
    orderBy: [
      { role: "asc" },
      { name: "asc" }
    ],
  });

  return { users };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperAdmin(request);
  
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "delete") {
    const userId = formData.get("userId") as string;
    await prisma.user.delete({
      where: { id: userId },
    });
    return redirect("/superadmin/users");
  }

  if (action === "create") {
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;
    const department = formData.get("department") as string;
    const role = formData.get("role") as "ADMIN" | "WORKER";

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        department,
        role,
      },
    });

    return redirect("/superadmin/users");
  }

  if (action === "update") {
    const userId = formData.get("userId") as string;
    const username = formData.get("username") as string;
    const name = formData.get("name") as string;
    const department = formData.get("department") as string;
    const role = formData.get("role") as "ADMIN" | "WORKER";
    const password = formData.get("password") as string;

    const updateData: any = {
      username,
      name,
      department,
      role,
    };

    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return redirect("/superadmin/users");
  }

  return null;
}

export default function SuperAdminUsers() {
  const { users } = useLoaderData<typeof loader>();
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const getPasswordDisplay = (user: any) => {
    // For demonstration purposes, show known passwords for seeded users
    // In a real application, you would never store or display actual passwords
    const knownPasswords: { [key: string]: string } = {
      'superadmin': 'superadmin123',
      'admin1': 'admin123',
      'admin2': 'admin123',
      'admin3': 'admin123',
      'admin4': 'admin123',
      'worker1': 'worker123',
      'worker2': 'worker123',
      'worker3': 'worker123',
      'worker4': 'worker123',
      'worker5': 'worker123',
      'worker6': 'worker123',
      'worker7': 'worker123',
      'worker8': 'worker123',
      'worker9': 'worker123',
      'worker10': 'worker123',
      'worker11': 'worker123',
      'worker12': 'worker123',
      'worker13': 'worker123',
      'worker14': 'worker123',
      'worker15': 'worker123',
      'worker16': 'worker123',
      'worker17': 'worker123',
      'worker18': 'worker123',
      'worker19': 'worker123',
      'worker20': 'worker123',
    };
    
    return knownPasswords[user.username] || '[Password encrypted - Click edit to change]';
  };

  const getRoleColor = (role: string) => {
    switch (role) {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Users className="h-6 w-6 mr-2" />
            User Management
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage all user accounts, passwords, and permissions
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
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    name="role"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="WORKER">Worker</option>
                    <option value="ADMIN">Admin</option>
                  </select>
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
          {users.map((user) => (
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
                        defaultValue={user.department}
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={user.role === "SUPERADMIN"}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                      >
                        <option value="WORKER">Worker</option>
                        <option value="ADMIN">Admin</option>
                        {user.role === "SUPERADMIN" && <option value="SUPERADMIN">Super Admin</option>}
                      </select>
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          @{user.username} • {user.department}
                        </p>
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
                      {user.role !== "SUPERADMIN" && (
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