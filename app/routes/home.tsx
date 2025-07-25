import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Ensure user is authenticated
  await requireUser(request);
  
  // Redirect to dashboard
  return redirect("/dashboard");
}

export default function Home() {
  // This component should never render since we always redirect
  return null;
}
