import { useLoaderData, Form } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/utils/session.server";
import { getUserWithPermissions } from "~/utils/rbac.server";
import { prisma } from "~/utils/db.server";
import { User, Building, Shield, CalendarDays, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { Calendar as CalendarComponent } from "~/components/ui/calendar";
import { format } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  // Get user with roles for profile display
  const userWithRoles = await getUserWithPermissions(user.id);
  if (!userWithRoles) {
    throw new Error("User not found");
  }

  // Get user's off days
  const offDays = await prisma.offDay.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      startDate: "desc",
    },
  });

  return { user: userWithRoles, offDays };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "updateOffDay") {
    const offDayId = formData.get("offDayId") as string;
    const endDate = formData.get("endDate") as string;

    // Verify the off day belongs to the current user
    const offDay = await prisma.offDay.findFirst({
      where: {
        id: offDayId,
        userId: user.id,
      },
    });

    if (!offDay) {
      throw new Error("Off day not found or access denied");
    }

    // Update only the end date
    await prisma.offDay.update({
      where: { id: offDayId },
      data: {
        endDate: new Date(endDate),
      },
    });

    return redirect("/profile");
  }

  if (action === "cancelOffDay") {
    const offDayId = formData.get("offDayId") as string;
    
    // Verify the off day belongs to the current user
    const offDay = await prisma.offDay.findFirst({
      where: {
        id: offDayId,
        userId: user.id,
      },
    });

    if (!offDay) {
      throw new Error("Off day not found or access denied");
    }

    await prisma.offDay.delete({
      where: { id: offDayId },
    });

    return redirect("/profile");
  }

  return null;
}

export default function Profile() {
  const { user, offDays } = useLoaderData<typeof loader>();
  const [editingOffDay, setEditingOffDay] = useState<string | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(undefined);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const handleEditOffDay = (offDay: { id: string; startDate: Date; endDate: Date; reason: string | null }) => {
    setEditingOffDay(offDay.id);
    setSelectedEndDate(new Date(offDay.endDate));
    setShowEndCalendar(false);
  };

  const handleCancelEditOffDay = () => {
    setEditingOffDay(null);
    setSelectedEndDate(undefined);
    setShowEndCalendar(false);
  };

  const handleEndDateSelect = (date: Date) => {
    setSelectedEndDate(date);
    setShowEndCalendar(false);
  };

  // Check if user is currently on an off day
  const today = new Date();
  const currentOffDay = offDays.find(offDay => {
    const startDate = new Date(offDay.startDate);
    const endDate = new Date(offDay.endDate);
    return today >= startDate && today <= endDate;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your account information and off days
        </p>
      </div>

      {/* Current Off Day Alert */}
      {currentOffDay && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CalendarDays className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                You are currently on an off day
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  <strong>Period:</strong> {format(new Date(currentOffDay.startDate), 'MMM dd, yyyy')} - {format(new Date(currentOffDay.endDate), 'MMM dd, yyyy')}
                </p>
                {currentOffDay.reason && (
                  <p><strong>Reason:</strong> {currentOffDay.reason}</p>
                )}
                <p className="mt-1 text-xs">You cannot check in during this period.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            User Information
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Personal details and account settings.
          </p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Full name
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {user.name}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Username
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {user.username}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Building className="h-4 w-4 mr-2" />
                Division
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {user.department}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Role
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {user.roles?.map((role: { id: string; name: string }) => {
                  const roleColor = role.name === "SUPERADMIN"
                    ? "bg-red-100 text-red-800"
                    : role.name === "ADMIN"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-green-100 text-green-800";
                  
                  return (
                    <span key={role.id} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${roleColor}`}>
                      {role.name}
                    </span>
                  );
                }) || (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    WORKER
                  </span>
                )}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">
                Member since
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Off Days Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
            <CalendarDays className="h-5 w-5 mr-2" />
            Off Days
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Your scheduled off days. You can edit end dates or cancel future off days.
          </p>
        </div>
        <div className="border-t border-gray-200">
          {offDays && offDays.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {offDays.map((offDay) => (
                <div key={offDay.id} className="px-4 py-4 sm:px-6">
                  {editingOffDay === offDay.id ? (
                    /* Edit Off Day Form */
                    <Form method="post" className="space-y-4">
                      <input type="hidden" name="action" value="updateOffDay" />
                      <input type="hidden" name="offDayId" value={offDay.id} />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date (Cannot be changed)
                          </label>
                          <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                            {format(new Date(offDay.startDate), 'MMM dd, yyyy')}
                          </div>
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
                                  minDate={new Date(offDay.startDate)}
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
                      </div>
                      
                      {offDay.reason && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reason (Set by admin)
                          </label>
                          <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                            {offDay.reason}
                          </div>
                        </div>
                      )}
                      
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
                          disabled={!selectedEndDate}
                          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Update End Date
                        </button>
                      </div>
                    </Form>
                  ) : (
                    /* Display Off Day */
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {format(new Date(offDay.startDate), 'MMM dd, yyyy')} - {format(new Date(offDay.endDate), 'MMM dd, yyyy')}
                            </div>
                            {offDay.reason && (
                              <div className="text-sm text-gray-500 mt-1">{offDay.reason}</div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              Set by admin/superadmin
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            {/* Status indicator */}
                            {(() => {
                              const today = new Date();
                              const startDate = new Date(offDay.startDate);
                              const endDate = new Date(offDay.endDate);
                              
                              if (today < startDate) {
                                return (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Upcoming
                                  </span>
                                );
                              } else if (today >= startDate && today <= endDate) {
                                return (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Active
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Past
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {/* Only allow editing future off days */}
                        {new Date(offDay.startDate) > new Date() && (
                          <>
                            <button
                              onClick={() => handleEditOffDay(offDay)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit End Date"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <Form method="post" className="inline">
                              <input type="hidden" name="action" value="cancelOffDay" />
                              <input type="hidden" name="offDayId" value={offDay.id} />
                              <button
                                type="submit"
                                onClick={(e) => {
                                  if (!confirm("Are you sure you want to cancel this off day?")) {
                                    e.preventDefault();
                                  }
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Cancel Off Day"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </Form>
                          </>
                        )}
                        {new Date(offDay.startDate) <= new Date() && (
                          <span className="text-xs text-gray-500 italic">
                            Cannot edit past/active off days
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <CalendarDays className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No off days scheduled</h3>
              <p className="mt-1 text-sm text-gray-500">
                Contact your admin or superadmin to schedule off days.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}