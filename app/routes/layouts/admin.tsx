import { Outlet, useLoaderData, Link, useLocation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { ArrowLeft } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  return { user };
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();
  const location = useLocation();
  
  // Check if we're on a child route (not the main admin index)
  const isChildRoute = location.pathname !== "/admin" && location.pathname !== "/admin/";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isChildRoute && (
          <div className="mb-6">
            <Link
              to="/admin"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Link>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}