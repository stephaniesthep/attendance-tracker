import { Form, useActionData, useNavigation, redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { createUser } from "~/utils/auth.server";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export async function loader({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const name = formData.get("name");
  const department = formData.get("department");
  const role = formData.get("role");

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof name !== "string" ||
    typeof department !== "string" ||
    typeof role !== "string"
  ) {
    return { error: "Invalid form data" };
  }

  if (username.length < 3) {
    return { error: "Username must be at least 3 characters" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  try {
    await createUser({
      username,
      password,
      name,
      department,
      role: role as "ADMIN" | "WORKER",
    });
    
    return redirect("/admin/users");
  } catch (error) {
    return { error: "Username already exists" };
  }
}

export default function NewUser() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          to="/admin/users"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Users
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Add New User</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a new worker or admin account
        </p>
      </div>

      <Form method="post" className="space-y-6 bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              required
              className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              name="username"
              id="username"
              required
              minLength={3}
              className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="johndoe"
            />
            <p className="mt-1 text-sm text-gray-500">
              Must be at least 3 characters
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              required
              minLength={6}
              className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            />
            <p className="mt-1 text-sm text-gray-500">
              Must be at least 6 characters
            </p>
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              Department
            </label>
            <input
              type="text"
              name="department"
              id="department"
              required
              className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="Engineering"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="role"
              name="role"
              required
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="WORKER">Worker</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>

        {actionData?.error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {actionData.error}
                </h3>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Link
            to="/admin/users"
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating..." : "Create User"}
          </button>
        </div>
      </Form>
    </div>
  );
}