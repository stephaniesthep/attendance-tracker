import { useLoaderData, Form, Link } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { prisma } from "~/utils/db.server";
import { getWorkerAttendanceStats } from "~/utils/attendance-stats.server";
import { createUser, updateUser, deleteUser, getAllRoles } from "~/utils/auth.server";
import { getUserPrimaryRole } from "~/utils/auth";
import { superAdminOnly } from "~/utils/middleware.server";
import { Users, Plus, Edit, Trash2, Eye, EyeOff, Calendar, CalendarDays, Shield } from "lucide-react";
import { useState } from "react";
import { Calendar as CalendarComponent } from "~/components/ui/calendar";
import { format } from "date-fns";
import { TodayAttendanceWidget } from "~/components/TodayAttendanceWidget";

export const loader = superAdminOnly(async ({ user }) => {
  const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
  
  // Get all users with their roles and off days
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          permissions: true,
        },
      },
      offDays: {
        orderBy: {
          startDate: "desc",
        },
      },
    },
    orderBy: [
      { name: "asc" }
    ],
  });

  // Get all available roles for the create/edit forms
  const roles = await getAllRoles();

  // Get user statistics
  const totalUsers = await prisma.user.count();
  
  const totalAdmins = await prisma.user.count({
    where: {
      roles: {
        some: {
          name: "ADMIN"
        }
      }
    }
  });
  
  const totalWorkers = await prisma.user.count({
    where: {
      roles: {
        some: {
          name: "WORKER"
        }
      }
    }
  });

  // Get unified attendance statistics for workers
  const workerStats = await getWorkerAttendanceStats();

  return {
    users,
    roles,
    currentUser: user,
    stats: {
      totalUsers,
      totalAdmins,
      totalWorkers,
      todayAttendance: workerStats.workersPresent,
      checkedInToday: workerStats.currentlyIn,
      completedToday: workerStats.completedToday,
    },
    todayDate: workerStats.todayDate,
  };
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

  if (action === "setOffDay") {
    const userId = formData.get("userId") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const reason = formData.get("reason") as string;

    // Create off day record
    await prisma.offDay.create({
      data: {
        userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason || "Off Day",
      },
    });

    return redirect("/superadmin/users");
  }

  if (action === "updateOffDay") {
    const offDayId = formData.get("offDayId") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const reason = formData.get("reason") as string;

    // Update off day record
    await prisma.offDay.update({
      where: { id: offDayId },
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason || "Off Day",
      },
    });

    return redirect("/superadmin/users");
  }

  if (action === "deleteOffDay") {
    const offDayId = formData.get("offDayId") as string;
    
    await prisma.offDay.delete({
      where: { id: offDayId },
    });

    return redirect("/superadmin/users");
  }

  return null;
});

export default function SuperAdminUsers() {
  const { users, roles, currentUser, stats, todayDate } = useLoaderData<typeof loader>();
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showOffDayForm, setShowOffDayForm] = useState<string | null>(null);
  const [editingOffDay, setEditingOffDay] = useState<string | null>(null);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(undefined);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  // Separate state for editing calendars
  const [editSelectedStartDate, setEditSelectedStartDate] = useState<Date | undefined>(undefined);
  const [editSelectedEndDate, setEditSelectedEndDate] = useState<Date | undefined>(undefined);
  const [showEditStartCalendar, setShowEditStartCalendar] = useState(false);
  const [showEditEndCalendar, setShowEditEndCalendar] = useState(false);

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleOffDayFormToggle = (userId: string | null) => {
    setShowOffDayForm(userId);
    setEditingOffDay(null);
    setSelectedStartDate(undefined);
    setSelectedEndDate(undefined);
    setShowStartCalendar(false);
    setShowEndCalendar(false);
    // Reset edit state
    setEditSelectedStartDate(undefined);
    setEditSelectedEndDate(undefined);
    setShowEditStartCalendar(false);
    setShowEditEndCalendar(false);
  };

  const handleEditOffDay = (offDay: { id: string; startDate: string; endDate: string; reason: string | null }) => {
    setEditingOffDay(offDay.id);
    setEditSelectedStartDate(new Date(offDay.startDate));
    setEditSelectedEndDate(new Date(offDay.endDate));
    setShowEditStartCalendar(false);
    setShowEditEndCalendar(false);
    // Reset add form state
    setSelectedStartDate(undefined);
    setSelectedEndDate(undefined);
    setShowStartCalendar(false);
    setShowEndCalendar(false);
  };

  const handleCancelEditOffDay = () => {
    setEditingOffDay(null);
    setEditSelectedStartDate(undefined);
    setEditSelectedEndDate(undefined);
    setShowEditStartCalendar(false);
    setShowEditEndCalendar(false);
  };

  const handleStartDateSelect = (date: Date) => {
    setSelectedStartDate(date);
    setShowStartCalendar(false);
    // If end date is before start date, reset it
    if (selectedEndDate && selectedEndDate < date) {
      setSelectedEndDate(undefined);
    }
  };

  const handleEndDateSelect = (date: Date) => {
    setSelectedEndDate(date);
    setShowEndCalendar(false);
  };

  // Separate handlers for edit calendar
  const handleEditStartDateSelect = (date: Date) => {
    setEditSelectedStartDate(date);
    setShowEditStartCalendar(false);
    // If end date is before start date, reset it
    if (editSelectedEndDate && editSelectedEndDate < date) {
      setEditSelectedEndDate(undefined);
    }
  };

  const handleEditEndDateSelect = (date: Date) => {
    setEditSelectedEndDate(date);
    setShowEditEndCalendar(false);
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

      {/* User Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Users */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3 bg-gray-500">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Users
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.totalUsers}
                    </div>
                    <div className="text-xs text-gray-500">
                      All system users
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Users */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3 bg-blue-500">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Admin Users
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.totalAdmins}
                    </div>
                    <div className="text-xs text-gray-500">
                      System administrators
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Worker Users */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3 bg-green-500">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Worker Users
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.totalWorkers}
                    </div>
                    <div className="text-xs text-gray-500">
                      Active workers
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Attendance Widget */}
      <TodayAttendanceWidget
        todayAttendance={stats.todayAttendance}
        totalWorkers={stats.totalWorkers}
        checkedInToday={stats.checkedInToday}
        completedToday={stats.completedToday}
        date={todayDate}
      />

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
                  <label className="block text-sm font-medium text-gray-700">Division</label>
                  <select
                    name="department"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select Division</option>
                    <option value="HVAC (AHU)">HVAC (AHU)</option>
                    <option value="HVAC (Hotel)">HVAC (Hotel)</option>
                    <option value="HVAC (Residence)">HVAC (Residence)</option>
                    <option value="Public Area">Public Area</option>
                    <option value="Kitchen & Laundry">Kitchen & Laundry</option>
                    <option value="Guest room (Hotel)">Guest room (Hotel)</option>
                    <option value="Guest room (Residence)">Guest room (Residence)</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
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
          {users.map((user: { id: string; username: string; name: string; department: string | null; roles: { id: string; name: string; displayName: string }[]; offDays: { id: string; startDate: string; endDate: string; reason: string | null }[] }) => (
            <li key={user.id} className="px-6 py-4">
              {/* Always show user details */}
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
                        @{user.username} • {user.department || 'No Division'}
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
                      onClick={() => handleOffDayFormToggle(showOffDayForm === user.id ? null : user.id)}
                      className="text-green-600 hover:text-green-900"
                      title="Manage Off Days"
                    >
                      <CalendarDays className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                      className={`${editingUser === user.id ? 'text-indigo-800 bg-indigo-100' : 'text-indigo-600 hover:text-indigo-900'} p-1 rounded`}
                      title="Edit User"
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

              {/* Show edit form when editing */}
              {editingUser === user.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Edit User Information</h4>
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
                        <label className="block text-sm font-medium text-gray-700">Division</label>
                        <select
                          name="department"
                          defaultValue={user.department || ""}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">Select Division</option>
                          <option value="HVAC (AHU)">HVAC (AHU)</option>
                          <option value="HVAC (Hotel)">HVAC (Hotel)</option>
                          <option value="HVAC (Residence)">HVAC (Residence)</option>
                          <option value="Public Area">Public Area</option>
                          <option value="Kitchen & Laundry">Kitchen & Laundry</option>
                          <option value="Guest room (Hotel)">Guest room (Hotel)</option>
                          <option value="Guest room (Residence)">Guest room (Residence)</option>
                          <option value="Supervisor">Supervisor</option>
                        </select>
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
                </div>
              )}
              
              {/* Off Day Management Section */}
              {showOffDayForm === user.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Manage Off Days</h4>
                  
                  {/* Set Off Day Form */}
                  <Form method="post" className="space-y-4">
                    <input type="hidden" name="action" value="setOffDay" />
                    <input type="hidden" name="userId" value={user.id} />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowStartCalendar(!showStartCalendar)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {selectedStartDate ? format(selectedStartDate, 'MMM dd, yyyy') : 'Select start date'}
                            <Calendar className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          </button>
                          {showStartCalendar && (
                            <div className="absolute z-10 mt-1">
                              <CalendarComponent
                                selected={selectedStartDate}
                                onSelect={handleStartDateSelect}
                                minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                                showClear={false}
                              />
                            </div>
                          )}
                        </div>
                        <input
                          type="hidden"
                          name="startDate"
                          value={selectedStartDate ? selectedStartDate.toISOString().split('T')[0] : ''}
                        />
                      </div>
                      
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowEndCalendar(!showEndCalendar)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {selectedEndDate ? format(selectedEndDate, 'MMM dd, yyyy') : 'Select end date'}
                            <Calendar className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          </button>
                          {showEndCalendar && (
                            <div className="absolute z-10 mt-1">
                              <CalendarComponent
                                selected={selectedEndDate}
                                onSelect={handleEndDateSelect}
                                minDate={selectedStartDate || new Date()}
                                showClear={false}
                              />
                            </div>
                          )}
                        </div>
                        <input
                          type="hidden"
                          name="endDate"
                          value={selectedEndDate ? selectedEndDate.toISOString().split('T')[0] : ''}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reason (Optional)
                        </label>
                        <input
                          type="text"
                          name="reason"
                          placeholder="e.g., Vacation, Sick Leave"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => handleOffDayFormToggle(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!selectedStartDate || !selectedEndDate}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Set Off Day
                      </button>
                    </div>
                  </Form>
                  
                  {/* Existing Off Days */}
                  {user.offDays && user.offDays.length > 0 && (
                    <div className="mt-6">
                      <h5 className="text-sm font-medium text-gray-900 mb-2">Current Off Days</h5>
                      <div className="space-y-2">
                        {user.offDays.map((offDay) => (
                          <div key={offDay.id} className="p-3 bg-white rounded-md border">
                            {editingOffDay === offDay.id ? (
                              /* Edit Off Day Form */
                              <Form method="post" className="space-y-4">
                                <input type="hidden" name="action" value="updateOffDay" />
                                <input type="hidden" name="offDayId" value={offDay.id} />
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Start Date
                                    </label>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setShowEditStartCalendar(!showEditStartCalendar)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                      >
                                        {editSelectedStartDate ? format(editSelectedStartDate, 'MMM dd, yyyy') : 'Select start date'}
                                        <Calendar className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                      </button>
                                      {showEditStartCalendar && (
                                        <div className="absolute z-10 mt-1">
                                          <CalendarComponent
                                            selected={editSelectedStartDate}
                                            onSelect={handleEditStartDateSelect}
                                            minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                                            showClear={false}
                                          />
                                        </div>
                                      )}
                                    </div>
                                    <input
                                      type="hidden"
                                      name="startDate"
                                      value={editSelectedStartDate ? editSelectedStartDate.toISOString().split('T')[0] : ''}
                                    />
                                  </div>
                                  
                                  <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      End Date
                                    </label>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setShowEditEndCalendar(!showEditEndCalendar)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                      >
                                        {editSelectedEndDate ? format(editSelectedEndDate, 'MMM dd, yyyy') : 'Select end date'}
                                        <Calendar className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                      </button>
                                      {showEditEndCalendar && (
                                        <div className="absolute z-10 mt-1">
                                          <CalendarComponent
                                            selected={editSelectedEndDate}
                                            onSelect={handleEditEndDateSelect}
                                            minDate={editSelectedStartDate || new Date()}
                                            showClear={false}
                                          />
                                        </div>
                                      )}
                                    </div>
                                    <input
                                      type="hidden"
                                      name="endDate"
                                      value={editSelectedEndDate ? editSelectedEndDate.toISOString().split('T')[0] : ''}
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Reason (Optional)
                                    </label>
                                    <input
                                      type="text"
                                      name="reason"
                                      defaultValue={offDay.reason || ''}
                                      placeholder="e.g., Vacation, Sick Leave"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                </div>
                                
                                <div className="flex justify-end space-x-3">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditOffDay}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={!editSelectedStartDate || !editSelectedEndDate}
                                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Update Off Day
                                  </button>
                                </div>
                              </Form>
                            ) : (
                              /* Display Off Day */
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {format(new Date(offDay.startDate), 'MMM dd, yyyy')} - {format(new Date(offDay.endDate), 'MMM dd, yyyy')}
                                  </div>
                                  {offDay.reason && (
                                    <div className="text-sm text-gray-500">{offDay.reason}</div>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleEditOffDay(offDay)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Edit Off Day"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <Form method="post" className="inline">
                                    <input type="hidden" name="action" value="deleteOffDay" />
                                    <input type="hidden" name="offDayId" value={offDay.id} />
                                    <button
                                      type="submit"
                                      onClick={(e) => {
                                        if (!confirm("Are you sure you want to remove this off day?")) {
                                          e.preventDefault();
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-900"
                                      title="Delete Off Day"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </Form>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}