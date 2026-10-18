import { useRouteError, isRouteErrorResponse } from "react-router-dom";

export default function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p>
        {isRouteErrorResponse(error)
          ? `${error.status} ${error.statusText}`
          : error?.message}
      </p>
    </div>
  );
}