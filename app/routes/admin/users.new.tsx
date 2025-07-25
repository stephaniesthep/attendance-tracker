import { Form, useActionData, useNavigation, redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { createUser } from "~/utils/auth.server";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export async function loader({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  // Redirect admin users away from this page since they shouldn't create users
  return redirect("/admin/users");
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const name = formData.get("name");
  const department = formData.get("division");
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

  // Prevent creation of SUPERADMIN accounts
  if (role === "SUPERADMIN") {
    return { error: "Cannot create SUPERADMIN accounts" };
  }

  try {
    // Get role ID based on role name - this is a simplified approach
    // In a real app, you'd fetch the actual role IDs from the database
    const roleIds = role === "ADMIN" ? ["admin-role-id"] : ["worker-role-id"];
    
    await createUser({
      username,
      password,
      name,
      department,
      roleIds,
    });
    
    return redirect("/admin/users");
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPERADMIN")) {
      return { error: "Cannot create SUPERADMIN accounts" };
    }
    return { error: "Username already exists or invalid data" };
  }
}

export default function NewUser() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/users">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Users
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New User</CardTitle>
          <CardDescription>
            Create a new worker or admin account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  type="text"
                  name="name"
                  id="name"
                  required
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  type="text"
                  name="username"
                  id="username"
                  required
                  minLength={3}
                  placeholder="johndoe"
                />
                <p className="text-sm text-muted-foreground">
                  Must be at least 3 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  type="password"
                  name="password"
                  id="password"
                  required
                  minLength={6}
                />
                <p className="text-sm text-muted-foreground">
                  Must be at least 6 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="division">Division</Label>
                <select
                  id="division"
                  name="division"
                  required
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  name="role"
                  required
                  defaultValue="WORKER"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="WORKER">Worker</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            {actionData?.error && (
              <div className="rounded-md bg-destructive/15 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-destructive">
                      {actionData.error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button variant="outline" asChild>
                <Link to="/admin/users">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create User"}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}