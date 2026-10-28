import { GLOBALS } from "@/globals";
import Image from "@/src/components/wraps/image";
import { BotIcon, HomeIcon, ListChevronsUpDownIcon, LogOutIcon, MenuIcon, PanelsTopLeftIcon, StretchHorizontalIcon, User2, XIcon } from "lucide-react";
import { NavLink, useLocation, useRouteLoaderData } from "react-router";
import { Pattern } from "./pattern";
import { useEffect, useState } from "react";


const exampleItems = [
    {
        name: 'Home',
        icon: (props) => <HomeIcon {...props} />,
        path: '/',
        subItems: []
    },
    {
        name: 'Test 1',
        icon: (props) => <BotIcon {...props} />,
        path: '/test',
        subItems: []
    },
    {
        name: 'Test 2',
        icon: (props) => <ListChevronsUpDownIcon {...props} />,
        path: '/test-2',
        expanded: true,
        subItems: [
            { name: 'sub-test', path: '/test/sub-test', icon: (props) => <StretchHorizontalIcon {...props} /> },
        ]
    },
]



export default function Sidebar({ items = [] }) {

    const thisItems = items.length > 0 ? items : exampleItems;
    const { pathname: currentPath } = useLocation();
    const isActive = (path) => currentPath === path;

    const [isDesktopOpen, setIsDesktopOpen] = useState(true);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.innerWidth < 1024;
    });

    const toggleDesktopSidebar = () => setIsDesktopOpen((v) => !v);
    const openMobileSidebar = () => setIsMobileOpen(true);
    const closeMobileSidebar = () => setIsMobileOpen(false);

    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth < 1024;
            setIsMobileViewport(isMobile);

            if (!isMobile) {
                setIsMobileOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (!isMobileViewport) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = isMobileOpen ? "hidden" : previousOverflow;

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobileOpen, isMobileViewport]);

    useEffect(() => {
        if (isMobileViewport) {
            setIsMobileOpen(false);
        }
    }, [currentPath, isMobileViewport]);

    const rootData = useRouteLoaderData("root");
    // logger.info("Sidebar: rootData", rootData);

    const fullName = rootData?.firstName || rootData?.lastName ? `${rootData.firstName} ${rootData.lastName}` : "User";

    const isOpen = isMobileViewport ? true : isDesktopOpen;

    const label = "text-sm whitespace-nowrap overflow-hidden transition-opacity duration-200 " +
        (isOpen ? "opacity-100" : "opacity-0 w-0");

    return (
        <>
            {isMobileViewport && (
                <button
                    onClick={openMobileSidebar}
                    aria-label="Open sidebar"
                    className="lg:hidden fixed top-3 left-3 z-40 p-2 rounded-lg border border-gray-300 bg-white/95 shadow-md"
                >
                    <MenuIcon className="size-5 opacity-75" />
                </button>
            )}

            {isMobileViewport && isMobileOpen && (
                <button
                    onClick={closeMobileSidebar}
                    aria-label="Close sidebar backdrop"
                    className="lg:hidden fixed inset-0 z-40 bg-black/30"
                />
            )}

            <div
                className={
                    "fixed inset-y-0 z-50 flex flex-col md:m-3 md:rounded-xl bg-gray-50 border border-gray-300 overflow-hidden shrink-0 transition-all duration-300 ease-in-out " +
                    (isMobileViewport
                        ? (isMobileOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full")
                        : ((isOpen ? "w-60" : "w-16") + " lg:static lg:translate-x-0 "))
                }
            >
                {/* sidebar header */}
                <div className="sm:h-24 relative p-3 shrink-0 flex flex-col justify-between items-center gap-2 border-b border-gray-200">
                    <div className={"w-full h-full flex items-center relative " + (isOpen ? "justify-between" : "justify-center")}>
                        {isOpen &&
                            <NavLink to="/" className="">
                                <Image
                                    src={GLOBALS.LOGO.MAIN}
                                    alt="logo"
                                    width={55}
                                    height={45}
                                />
                            </NavLink>
                        }
                        {/* {isOpen &&
                        <p className={"font-semibold text-gray-600 " + label}>
                            {GLOBALS.PROJECT_NAME}
                        </p>
                    } */}
                        <button
                            onClick={isMobileViewport ? closeMobileSidebar : toggleDesktopSidebar}
                            aria-label={isMobileViewport ? "Close sidebar" : "Toggle sidebar"}
                            className="p-2 hover:scale-105 transition-all duration-200 ease-in-out cursor-pointer"
                        >
                            {isMobileViewport ? (
                                <XIcon className="size-5 opacity-75" />
                            ) : (
                                <PanelsTopLeftIcon className="size-5 opacity-75" />
                            )}
                        </button>
                    </div>
                    {!isOpen &&
                        <div className="flex justify-center">
                            <NavLink to="/" className="">
                                <Image
                                    src={GLOBALS.LOGO.MAIN}
                                    alt="logo"
                                    width={20}
                                    height={20}
                                />
                            </NavLink>
                        </div>
                    }

                    <Pattern color={'var(--accent-light)'} className="opacity-25" />
                </div>

                {/* sidebar body */}
                <div className="w-full h-full flex flex-col gap-2 p-3 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {thisItems.map((item, index) => (
                        <div key={index} className="flex flex-col">
                            <NavLink
                                to={item.path}
                                title={item.name}
                                onClick={isMobileViewport ? closeMobileSidebar : undefined}
                                className={
                                    "flex items-center p-2 w-full rounded-lg hover:bg-white hover:border-gray-400 hover:shadow-md hover:text-(--accent) transition-all duration-200 ease-in-out " +
                                    (isOpen ? "gap-3" : "gap-0") +
                                    (isActive(item.path) ? " bg-white border-gray-400 shadow-md text-(--accent)" : "")
                                }
                            >
                                {item.icon && <div className="w-7 flex justify-center"> <item.icon className="size-5 shrink-0 opacity-75" /></div>}
                                <span className={"font-medium " + label}>{item.name}</span>
                            </NavLink>

                            {isOpen && item.subItems?.length > 0 && (
                                <div className="ml-4 flex flex-col gap-1">
                                    {item.subItems.map((subItem, subIndex) => (
                                        <NavLink
                                            key={subIndex}
                                            to={subItem.path}
                                            title={subItem.name}
                                            onClick={isMobileViewport ? closeMobileSidebar : undefined}
                                            className={
                                                "flex items-center p-2 w-full rounded-lg hover:bg-white hover:border-gray-400 hover:shadow-md hover:text-(--accent) transition-all duration-200 ease-in-out gap-3 " +
                                                (isActive(subItem.path) ? " bg-white border-gray-400 shadow-md text-(--accent)" : "")
                                            }
                                        >
                                            {subItem.icon && <subItem.icon className="size-4 shrink-0 opacity-75" />}
                                            <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* sidebar footer */}
                <div className="m-auto w-full px-3 py-5 border-t border-gray-200">

                    <div className="flex items-center gap-2 ">
                        {isOpen &&
                            <>
                                <div className="p-1 bg-gray-200 size-8 rounded-full flex justify-center items-center">
                                    <User2 className="size-5" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className={"font-medium " + label}>
                                        {fullName}
                                    </span>
                                    <span className={"text-xs text-gray-500 " + label}>
                                        {rootData?.email || ""}
                                    </span>
                                </div>
                            </>
                        }
                        <NavLink to="/auth/signout" className="flex flex-1 gap-3 items-center justify-center" >
                            <LogOutIcon className="size-4 opacity-75" />
                        </NavLink>
                    </div>
                </div>
            </div>
        </>
    );
}