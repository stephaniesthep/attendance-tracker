import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/utils/session.server";
import { getUserWithPermissions } from "~/utils/rbac.server";
import { getUserPrimaryRole } from "~/utils/auth";
import { User, Building, Shield } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  // Get user with roles for profile display
  const userWithRoles = await getUserWithPermissions(user.id);
  if (!userWithRoles) {
    throw new Error("User not found");
  }
  return { user: userWithRoles };
}

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your account information
        </p>
      </div>

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
    </div>
  );
}