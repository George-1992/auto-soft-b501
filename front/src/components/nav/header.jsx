import WebpushButton from "@/src/components/notifications/webpush";
import { SecondaryButton } from "@/src/components/ui/buttons";
import LanguageSwitch from "@/src/components/ui/locale";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { useOnline } from "@/src/hooks";
import { sendBackRequest } from "@/src/services/backend";
import { SettingsIcon, Settings2Icon, User2Icon } from "lucide-react";
import { NavLink } from "react-router";

export default function Header({ items }) {

    const online = useOnline();
    // logger.info("Header: online", online);

    const test = (e) => {
        e.preventDefault();
        sendBackRequest({
            itsFor: 'test2',
        })
        notify({
            type: 'info',
            message: 'Test notification',
        })
    }

    return (
        <div className="w-full flex items-center justify-end">

            <div className="flex items-center py-2 px-3 gap-2">

                {/* settings */}
                <div className="flex items-center gap-2">
                    <SecondaryButton onClick={test} className="px-3 py-1">
                        Test
                    </SecondaryButton>


                    <div>
                        {online ? (
                            <div className="size-3 bg-green-500 rounded-full" />
                        ) : (
                            <div className="size-5 text-red-500" />
                        )}
                    </div>

                    <WebpushButton />
                    {/* <LanguageSwitch /> */}
                    <NavLink
                        to="/settings"
                        className="flex items-center gap-2 p-2 rounded-full shadow-md hover:bg-gray-100 transition-all duration-200 ease-in-out border border-gray-300 bg-white"
                    >
                        <SettingsIcon className="size-5 opacity-75" />
                    </NavLink>
                    <NavLink
                        to="/profile"
                        className="flex items-center gap-2 p-2 rounded-full shadow-md hover:bg-gray-100 transition-all duration-200 ease-in-out border border-gray-300 bg-white"
                    >
                        <User2Icon className="size-5 opacity-75" />
                    </NavLink>
                </div>
            </div>
        </div>
    );
}