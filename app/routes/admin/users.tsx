import { Link, useLoaderData, Form } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { getWorkerAttendanceStats } from "~/utils/attendance-stats.server";
import { getUserPrimaryRole } from "~/utils/auth";
import { updateUser, getAllRoles } from "~/utils/auth.server";
import { Plus, Edit, Trash2, Shield, User, Users, CalendarDays } from "lucide-react";
import type { User as PrismaUser } from "@prisma/client";
import { TodayAttendanceWidget } from "~/components/TodayAttendanceWidget";
import { useState } from "react";
import { Calendar as CalendarComponent } from "~/components/ui/calendar";
import { format } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  
  const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
  
  const users = await prisma.user.findMany({
    include: {
      roles: true,
      offDays: {
        orderBy: {
          startDate: "desc",
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get all available roles for the edit forms
  const roles = await getAllRoles();

  // Get user statistics
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
    stats: {
      totalAdmins,
      totalWorkers,
      todayAttendance: workerStats.workersPresent,
      checkedInToday: workerStats.currentlyIn,
      completedToday: workerStats.completedToday,
    },
    todayDate: workerStats.todayDate,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "update") {
    const userId = formData.get("userId") as string;
    const name = formData.get("name") as string;
    const department = formData.get("department") as string;

    // Admin can only update name and department for workers
    await updateUser(userId, {
      name,
      department: department || undefined,
    });

    return redirect("/admin/users");
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

    return redirect("/admin/users");
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

    return redirect("/admin/users");
  }

  if (action === "deleteOffDay") {
    const offDayId = formData.get("offDayId") as string;
    
    await prisma.offDay.delete({
      where: { id: offDayId },
    });

    return redirect("/admin/users");
  }

  return null;
}

export default function AdminUsers() {
  const { users, roles, stats, todayDate } = useLoaderData<typeof loader>();
  const [editingUser, setEditingUser] = useState<string | null>(null);
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

  const handleEditOffDay = (offDay: { id: string; startDate: Date; endDate: Date; reason: string | null }) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage worker information and off days (password changes require superadmin)
          </p>
        </div>
        <div className="text-sm text-gray-500 italic">
          Limited Edit Access
        </div>
      </div>

      {/* User Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users.map((user) => (
            <li key={user.id} className="px-6 py-4">
              {/* Always show user details */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {user.roles?.some((role) => role.name === "ADMIN" || role.name === "SUPERADMIN") ? (
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
                      @{user.username} • {user.department || 'No Division'} • {getUserPrimaryRole(user as any)}
                    </div>
                    <div className="mt-1 flex items-center text-xs text-gray-500 space-x-1">
                      {user.roles?.map((role) => {
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
                  {/* Only show off day management for workers */}
                  {user.roles?.some((role) => role.name === "WORKER") && (
                    <button
                      onClick={() => {
                        handleOffDayFormToggle(showOffDayForm === user.id ? null : user.id);
                        setEditingUser(null); // Close edit form when opening off day form
                      }}
                      className={`${showOffDayForm === user.id ? 'text-green-800 bg-green-100' : 'text-green-600 hover:text-green-900'} p-1 rounded`}
                      title="Manage Off Days"
                    >
                      <CalendarDays className="h-4 w-4" />
                    </button>
                  )}
                  {/* Only allow editing workers */}
                  {user.roles?.some((role) => role.name === "WORKER") && (
                    <button
                      onClick={() => {
                        setEditingUser(editingUser === user.id ? null : user.id);
                        handleOffDayFormToggle(null); // Close off day form when opening edit form
                      }}
                      className={`${editingUser === user.id ? 'text-indigo-800 bg-indigo-100' : 'text-indigo-600 hover:text-indigo-900'} p-1 rounded`}
                      title="Edit Worker Info"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {user.roles?.some((role) => role.name === "WORKER") && (
                    <span className="text-xs text-gray-500 italic">
                      Limited Edit Access
                    </span>
                  )}
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
                        <label className="block text-sm font-medium text-gray-700">Username (Cannot be changed)</label>
                        <div className="mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                          {user.username}
                        </div>
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
                      <div className="col-span-2">
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
                </div>
              )}
              
              {/* Off Day Management Section - Only for workers */}
              {showOffDayForm === user.id && user.roles?.some((role) => role.name === "WORKER") && (
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
                            <CalendarDays className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                            <CalendarDays className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                                        <CalendarDays className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                                        <CalendarDays className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
          