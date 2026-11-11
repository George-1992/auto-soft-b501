import WebpushButton from "@/src/components/notifications/webpush";
import { SecondaryButton } from "@/src/components/ui/buttons";
import LanguageSwitch from "@/src/components/ui/locale";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { useOnline } from "@/src/hooks";
import { sendBackRequest } from "@/src/services/backend";
import { ChevronDownIcon, LogOutIcon, SettingsIcon, User2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";

export default function Header({ items }) {

    const online = useOnline();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
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

    useEffect(() => {
        const onClickOutside = (event) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onClickOutside);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
        };
    }, []);

    return (
        <div className="w-full flex items-center justify-end">

            <div className="flex items-center py-2 px-3 gap-2">

                {/* settings */}
                <div className="flex items-center gap-2">



                    <div>
                        {online ? (
                            <div className="size-3 bg-green-500 rounded-full" />
                        ) : (
                            <div className="size-5 text-red-500" />
                        )}
                    </div>

                    {/* <WebpushButton /> */}
                    {/* <LanguageSwitch /> */}
                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen((v) => !v)}
                            className="flex items-center gap-2 px-3 py-2 rounded-full shadow-md hover:bg-gray-100 transition-all duration-200 ease-in-out border border-gray-300 bg-white"
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                        >
                            <SettingsIcon className="size-5 opacity-75" />
                            <ChevronDownIcon className="size-4 opacity-70" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-1 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg p-1 z-50">
                                <NavLink
                                    to="/settings"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 text-sm"
                                >
                                    <SettingsIcon className="size-4 opacity-75" />
                                    <span>Settings</span>
                                </NavLink>
                                <NavLink
                                    to="/profile"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 text-sm"
                                >
                                    <User2Icon className="size-4 opacity-75" />
                                    <span>Profile</span>
                                </NavLink>
                                <NavLink
                                    to="/auth/signout"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 text-sm text-rose-600"
                                >
                                    <LogOutIcon className="size-4" />
                                    <span>Logout</span>
                                </NavLink>
                                <SecondaryButton onClick={test} className="px-3 py-1">
                                    Test-3
                                </SecondaryButton>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}