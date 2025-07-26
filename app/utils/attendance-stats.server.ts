import { prisma } from "~/utils/db.server";
import { format } from "date-fns";

export interface AttendanceStats {
  totalWorkers: number;
  workersPresent: number;
  currentlyIn: number;
  completedToday: number;
  todayDate: string;
}

/**
 * Get unified attendance statistics for workers only
 * This ensures consistent data across superadmin and admin dashboards
 */
export async function getWorkerAttendanceStats(date?: Date): Promise<AttendanceStats> {
  const targetDate = date || new Date();
  const todayFormatted = format(targetDate, 'yyyy-MM-dd');

  // Get all calculations in parallel for better performance
  const [
    totalWorkers,
    workersPresent,
    currentlyIn,
    completedToday
  ] = await Promise.all([
    // Total number of users with WORKER role
    prisma.user.count({
      where: {
        roles: {
          some: {
            name: "WORKER",
          },
        },
      },
    }),

    // Number of unique workers who have attendance records today
    prisma.attendance
      .groupBy({
        by: ["userId"],
        where: {
          date: todayFormatted,
          user: {
            roles: {
              some: {
                name: "WORKER",
              },
            },
          },
        },
      })
      .then((result) => result.length),

    // Number of workers currently checked in (no checkout time)
    prisma.attendance.count({
      where: {
        date: todayFormatted,
        checkOut: null,
        user: {
          roles: {
            some: {
              name: "WORKER",
            },
          },
        },
      },
    }),

    // Number of workers who completed their day (have checkout time)
    prisma.attendance.count({
      where: {
        date: todayFormatted,
        checkOut: { not: null },
        user: {
          roles: {
            some: {
              name: "WORKER",
            },
          },
        },
      },
    }),
  ]);

  return {
    totalWorkers,
    workersPresent,
    currentlyIn,
    completedToday,
    todayDate: todayFormatted,
  };
}

/**
 * Get attendance statistics for a specific user role
 * Useful for getting admin/superadmin specific stats if needed
 */
export async function getUserRoleAttendanceStats(
  roleName: string,
  date?: Date
): Promise<Omit<AttendanceStats, 'todayDate'> & { todayDate: string; roleName: string }> {
  const targetDate = date || new Date();
  const todayFormatted = format(targetDate, 'yyyy-MM-dd');

  const [
    totalUsers,
    usersPresent,
    currentlyIn,
    completedToday
  ] = await Promise.all([
    prisma.user.count({
      where: {
        roles: {
          some: {
            name: roleName,
          },
        },
      },
    }),

    prisma.attendance
      .groupBy({
        by: ["userId"],
        where: {
          date: todayFormatted,
          user: {
            roles: {
              some: {
                name: roleName,
              },
            },
          },
        },
      })
      .then((result) => result.length),

    prisma.attendance.count({
      where: {
        date: todayFormatted,
        checkOut: null,
        user: {
          roles: {
            some: {
              name: roleName,
            },
          },
        },
      },
    }),

    prisma.attendance.count({
      where: {
        date: todayFormatted,
        checkOut: { not: null },
        user: {
          roles: {
            some: {
              name: roleName,
            },
          },
        },
      },
    }),
  ]);

  return {
    totalWorkers: totalUsers,
    workersPresent: usersPresent,
    currentlyIn,
    completedToday,
    todayDate: todayFormatted,
    roleName,
  };
}

/**
 * Get comprehensive attendance statistics for all roles
 * Useful for superadmin dashboard that might want to show all user types
 */
export async function getAllRolesAttendanceStats(date?: Date) {
  const targetDate = date || new Date();
  
  const [workerStats, adminStats, superadminStats] = await Promise.all([
    getUserRoleAttendanceStats("WORKER", targetDate),
    getUserRoleAttendanceStats("ADMIN", targetDate),
    getUserRoleAttendanceStats("SUPERADMIN", targetDate),
  ]);

  return {
    workers: workerStats,
    admins: adminStats,
    superadmins: superadminStats,
    todayDate: format(targetDate, 'yyyy-MM-dd'),
  };
}