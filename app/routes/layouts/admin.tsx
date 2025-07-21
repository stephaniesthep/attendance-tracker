import { Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return null;
}

export default function AdminLayout() {
  return <Outlet />;
}