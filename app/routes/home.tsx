import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { Welcome } from "../welcome/welcome";

export const meta: MetaFunction = () => {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
};

export function loader({ context }: LoaderFunctionArgs) {
  return { message: (context as any)?.VALUE_FROM_EXPRESS || "Welcome!" };
}

export default function Home() {
  const { message } = useLoaderData<typeof loader>();
  return <Welcome message={message} />;
}
