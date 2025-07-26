import { useLoaderData, Form } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireSuperAdmin } from "~/utils/session.server";
import { prisma } from "~/utils/db.server";
import { redirect } from "react-router";
import bcrypt from "bcryptjs";
import { User, Shield, Key, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { SuperAdminDashboardStats } from "~/components/SuperAdminDashboardStats";
import { format } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUser = await requireSuperAdmin(request);
  
  // Get user with password relation
  const user = await prisma.user.findUnique({
    where: { id: baseUser.id },
    include: {
      password: true,
      roles: true,
    },
  });
  
  if (!user) {
    throw new Error("User not found");
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayString = format(today, 'yyyy-MM-dd');

  // Get dashboard statistics
  const [totalWorkers, todayAttendances, superAdminAttendance] = await Promise.all([
    // Total active workers (excluding superadmins)
    prisma.user.count({
      where: {
        isActive: true,
        roles: {
          none: {
            name: "SUPER_ADMIN"
          }
        }
      }
    }),
    
    // Today's attendances for all workers
    prisma.attendance.findMany({
      where: {
        date: todayString,
        user: {
          isActive: true,
          roles: {
            none: {
              name: "SUPER_ADMIN"
            }
          }
        }
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        status: true
      }
    }),
    
    // Superadmin's own attendance for today
    prisma.attendance.findFirst({
      where: {
        userId: user.id,
        date: todayString
      },
      select: {
        checkIn: true,
        checkOut: true,
        status: true
      }
    })
  ]);

  // Calculate statistics
  const workersPresent = todayAttendances.filter(att => att.status === 'present').length;
  const currentlyIn = todayAttendances.filter(att => att.checkIn && !att.checkOut).length;
  
  // Determine superadmin status
  let superAdminStatus: "completed" | "pending" | "not_started" = "not_started";
  if (superAdminAttendance) {
    if (superAdminAttendance.checkOut) {
      superAdminStatus = "completed";
    } else if (superAdminAttendance.checkIn) {
      superAdminStatus = "pending";
    }
  }

  const dashboardStats = {
    todayDate: today.toISOString(),
    superAdminStatus,
    workersPresent,
    totalWorkers,
    currentlyIn
  };
  
  return { user, dashboardStats };
}

export async function action({ request }: ActionFunctionArgs) {
  const baseUser = await requireSuperAdmin(request);
  
  // Get user with password relation
  const user = await prisma.user.findUnique({
    where: { id: baseUser.id },
    include: {
      password: true,
      roles: true,
    },
  });
  
  if (!user || !user.password) {
    throw new Error("User or password not found");
  }
  
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "changePassword") {
    const currentPassword = formData.get("currentPassword") as string;
    const verificationCode = formData.get("verificationCode") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password.hash);
    if (!isCurrentPasswordValid) {
      return {
        error: "Current password is incorrect",
        success: null,
      };
    }

    // Verify verification code
    if (!(user as any).superadminVerifyCode || verificationCode !== (user as any).superadminVerifyCode) {
      return {
        error: "Verification code is incorrect or not set",
        success: null,
      };
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return {
        error: "New passwords do not match",
        success: null,
      };
    }

    // Check password strength
    if (newPassword.length < 8) {
      return {
        error: "New password must be at least 8 characters long",
        success: null,
      };
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await (prisma as any).superadmins.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      error: null,
      success: "Password changed successfully",
    };
  }

  if (action === "updateVerificationCode") {
    const currentPassword = formData.get("currentPassword") as string;
    const currentVerificationCode = formData.get("currentVerificationCode") as string;
    const newVerificationCode = formData.get("newVerificationCode") as string;

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password.hash);
    if (!isCurrentPasswordValid) {
      return {
        error: "Current password is incorrect",
        success: null,
      };
    }

    // Verify current verification code
    if (!(user as any).superadminVerifyCode || currentVerificationCode !== (user as any).superadminVerifyCode) {
      return {
        error: "Current verification code is incorrect or not set",
        success: null,
      };
    }

    // Check new verification code strength
    if (newVerificationCode.length < 6) {
      return {
        error: "New verification code must be at least 6 characters long",
        success: null,
      };
    }

    // Update verification code
    await (prisma as any).superadmins.update({
      where: { id: user.id },
      data: { superadminVerifyCode: newVerificationCode },
    });

    return {
      error: null,
      success: "Verification code updated successfully",
    };
  }

  return null;
}

export default function SuperAdminProfile() {
  const { user, dashboardStats } = useLoaderData<typeof loader>();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeVerificationCode, setShowChangeVerificationCode] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
          <User className="h-6 w-6 mr-2" />
          Super Admin Profile
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your super admin account settings and security
        </p>
      </div>

      {/* Dashboard Statistics */}
      <SuperAdminDashboardStats
        todayDate={dashboardStats.todayDate}
        superAdminStatus={dashboardStats.superAdminStatus}
        workersPresent={dashboardStats.workersPresent}
        totalWorkers={dashboardStats.totalWorkers}
        currentlyIn={dashboardStats.currentlyIn}
      />

      {/* Profile Information */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-red-600" />
            Account Information
          </h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Full Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Username</dt>
              <dd className="mt-1 text-sm text-gray-900">@{(user as any).username}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Department</dt>
              <dd className="mt-1 text-sm text-gray-900">{(user as any).department || "Super Admin"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Role</dt>
              <dd className="mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <Shield className="h-3 w-3 mr-1" />
                  SUPER ADMIN
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Account Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(user.updatedAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Key className="h-5 w-5 mr-2 text-indigo-600" />
            Security Settings
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-yellow-200 rounded-lg bg-yellow-50">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Password Protection</p>
                  <p className="text-sm text-yellow-700">Change your password with verification code</p>
                </div>
              </div>
              <button
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="px-4 py-2 border border-yellow-300 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-100"
              >
                Change Password
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border border-blue-200 rounded-lg bg-blue-50">
              <div className="flex items-center">
                <Key className="h-5 w-5 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Verification Code</p>
                  <p className="text-sm text-blue-700">Update your security verification code</p>
                </div>
              </div>
              <button
                onClick={() => setShowChangeVerificationCode(!showChangeVerificationCode)}
                className="px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-800 hover:bg-blue-100"
              >
                Update Code
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      {showChangePassword && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
            <Form method="post" className="space-y-4">
              <input type="hidden" name="action" value="changePassword" />
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Verification Code</label>
                <input
                  type="text"
                  name="verificationCode"
                  required
                  placeholder="Enter your verification code"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter the pre-set verification code to authorize password change
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  required
                  minLength={8}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Change Password
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Change Verification Code Form */}
      {showChangeVerificationCode && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Update Verification Code</h3>
            <Form method="post" className="space-y-4">
              <input type="hidden" name="action" value="updateVerificationCode" />
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Current Verification Code</label>
                <input
                  type="text"
                  name="currentVerificationCode"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">New Verification Code</label>
                <input
                  type="text"
                  name="newVerificationCode"
                  required
                  minLength={6}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Must be at least 6 characters long
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowChangeVerificationCode(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Update Code
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}