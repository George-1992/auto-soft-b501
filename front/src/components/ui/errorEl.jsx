import { NavLink, useRouteError } from "react-router";
import { setMetas } from "@/src/services/metas";


export default function ErrorEl() {

    setMetas({
        title: 'Error',
    });

    let error = useRouteError();

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-4xl font-bold mb-4">Oops!</h1>
            <p className="text-lg mb-8">Sorry, an unexpected error has occurred.</p>
            <NavLink to="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Go back to Home</NavLink>

            <div className="sm:h-96 my-3 w-1/2 overflow-hidden rounded-md bg-red-50">
                <div className="p-4 overflow-auto text-sm text-red-700">
                    {error.statusText || error.message}
                </div>
            </div>

        </div>
    );
}