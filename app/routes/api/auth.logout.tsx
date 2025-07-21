import type { ActionFunctionArgs } from "react-router";
import { logout } from "~/utils/session.server";

export async function action({ request }: ActionFunctionArgs) {
  return logout(request);
}