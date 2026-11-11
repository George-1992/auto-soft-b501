import { GLOBALS } from '@/globals';
import { auth, handleSignout } from '@/src/components/auth';
import AuthEl from '@/src/components/auth/parts';
import ErrorEl from '@/src/components/ui/errorEl'
import NotFound from '@/src/components/ui/notFound';
import { logger } from '@/src/services/logger';
import { createBrowserRouter, Outlet, redirect, RouterProvider } from 'react-router'
import Header from '@/src/components/nav/header.jsx';
import Sidebar from '@/src/components/nav/sidebar.jsx';
import { setMetas } from '@/src/services/metas';
import { BotIcon, BoxesIcon, CalendarDaysIcon, CalendarIcon, CarFrontIcon, HomeIcon, ListChevronsUpDownIcon, MapPinned, NotebookTabsIcon, PackageSearchIcon, RouteIcon, ScanSearchIcon, SearchIcon, ShellIcon, StretchHorizontalIcon, TestTubeDiagonalIcon, ToolboxIcon, UsersRoundIcon, WrenchIcon } from 'lucide-react';
import ToasterSonnar from '@/src/components/ui/sonnar/sonnar';
import Profile from '@/src/pages/profile';
import Settings from '@/src/pages/settings';
import Home from '@/src/pages/home';
import AiChatPage from '@/src/pages/aiChat';
import LocationsPage from '@/src/pages/locations';
import CustomersPage from '@/src/pages/customers';
import VehiclesPage from '@/src/pages/vehicles';
import ServicesPage from '@/src/pages/services';
import NotesPage from '@/src/pages/notes';
import OrdersPage from '@/src/pages/orders';
import PipelinesPage from '@/src/pages/pipelines';
import InventoryPage from '@/src/pages/parts';
import AppointmentsPage from '@/src/pages/appointments';
import PartsSearchPage from '@/src/pages/partsSearch';

// const AUTH_PATHS = GLOBALS.AUTH_PATHS || [];
// const authRes = await auth();
// logger.info("authRes", authRes);


setMetas({
    title: GLOBALS.PROJECT_NAME,
    description: '',
    icon: GLOBALS.LOGO.MAIN,
});


const Test = () => {
    setMetas({
        title: 'Test-' + GLOBALS.PROJECT_NAME,
        description: '',
        icon: GLOBALS.LOGO.MAIN,
    });
    return <h1>test</h1>
}
const Test2 = () => {
    setMetas({
        title: 'Test2-' + GLOBALS.PROJECT_NAME,
        description: '',
        icon: GLOBALS.LOGO.MAIN,
    });
    return <h1>Test2</h1>
}


const requireAuth = async ({ request }) => {
    const res = await auth();
    if (!res.success) {
        // const from = new URL(request.url).pathname;
        // throw redirect(`/auth/signin?from=${encodeURIComponent(from)}`);
        throw redirect('/auth/signin');
    }
    // logger.info("requireAuth res", res);
    return res.data || res;
};

const redirectIfAuthed = async () => {
    const res = await auth();
    if (res.success) throw redirect('/');
    return null;
};


const sidebarItems = [
    {
        name: 'Home',
        icon: (props) => <HomeIcon {...props} />,
        path: '/',
        subItems: []
    },
    {
        name: 'Services',
        icon: (props) => <ToolboxIcon {...props} />,
        path: '/services',
        expanded: false,
        subItems: [
            {
                name: 'Orders',
                icon: (props) => <WrenchIcon {...props} />,
                path: '/services/orders',
                subItems: []
            },
            {
                name: 'Appointments',
                icon: (props) => <CalendarDaysIcon {...props} />,
                path: '/services/appointments',
                subItems: []
            },
            {
                name: 'Services',
                icon: (props) => <ToolboxIcon {...props} />,
                path: '/services/services',
                subItems: []
            },
            {
                name: 'Pipelines',
                icon: (props) => <RouteIcon {...props} />,
                path: '/services/pipelines',
                subItems: []
            },
        ]
    },
    {
        name: 'Locations',
        icon: (props) => <MapPinned {...props} />,
        path: '/locations',
        subItems: []
    },
    {
        name: 'Customers',
        icon: (props) => <UsersRoundIcon {...props} />,
        path: '/customers',
        subItems: []
    },
    {
        name: 'Vehicles',
        icon: (props) => <CarFrontIcon {...props} />,
        path: '/vehicles',
        subItems: []
    },
    {
        name: 'Inventory',
        icon: (props) => <BoxesIcon {...props} />,
        path: '/inventory',
        expanded: true,
        subItems: [
            {
                name: 'Search',
                icon: (props) => <ScanSearchIcon {...props} />,
                path: '/inventory/search',
            },
            {
                name: 'Parts',
                icon: (props) => <PackageSearchIcon {...props} />,
                path: '/inventory/parts',
            },
        ]
    },
    // {
    //     name: 'Notes',
    //     icon: (props) => <NotebookTabsIcon {...props} />,
    //     path: '/notes',
    //     subItems: []
    // },
    // {
    //     name: 'AI Chat',
    //     icon: (props) => <BotIcon {...props} />,
    //     path: '/ai-chat',
    //     subItems: []
    // },
    // {
    //     name: 'Test 1',
    //     icon: (props) => <TestTubeDiagonalIcon {...props} />,
    //     path: '/test',
    //     subItems: []
    // },
    // {
    //     name: 'Test 2',
    //     icon: (props) => <ListChevronsUpDownIcon {...props} />,
    //     path: '/test-2',
    //     expanded: true,
    //     subItems: [
    //         { name: 'sub-test', path: '/test/sub-test', icon: (props) => <StretchHorizontalIcon {...props} /> },
    //     ]
    // },
]



const router = createBrowserRouter([
    {
        id: 'root',
        loader: requireAuth,
        errorElement: <ErrorEl />,
        element: (
            <div className='flex h-screen w-full overflow-hidden'>
                <Sidebar items={sidebarItems} />
                <div className='flex min-w-0 flex-1 flex-col'>
                    <div className='shrink-0'>
                        <Header items={[]} />
                    </div>
                    <div className='min-h-0 flex-1 w-full px-3 py-5 pb-10 overflow-auto'>
                        <Outlet />
                        {/* <div className='h-10 md:h-20'></div> */}
                    </div>
                </div>
            </div>
        ),
        children: [
            { index: true, element: <Home /> },
            { path: 'notes', element: <NotesPage /> },
            { path: 'ai-chat', element: <AiChatPage /> },
            { path: 'profile', element: <Profile /> },
            { path: 'settings', element: <Settings /> },
            { path: 'locations', element: <LocationsPage /> },
            { path: 'customers', element: <CustomersPage /> },
            { path: 'vehicles', element: <VehiclesPage /> },

            { path: '/services/orders', element: <OrdersPage /> },
            { path: '/services/appointments', element: <AppointmentsPage /> },
            { path: '/services/services', element: <ServicesPage /> },
            { path: '/services/pipelines', element: <PipelinesPage /> },

            { path: 'inventory/parts', element: <PartsSearchPage /> },
            { path: 'inventory/search', element: <PartsSearchPage /> },



            { path: 'test', element: <Test /> },
            { path: 'test-2/:id', element: <Test2 /> },
            { path: '*', element: <NotFound /> },
        ],
    },
    {
        id: 'auth',
        loader: redirectIfAuthed,
        errorElement: <ErrorEl />,
        children: [
            { path: '/auth/signin', element: <AuthEl type='signin' /> },
            { path: '/auth/signup', element: <AuthEl type='signup' /> },
            { path: '/auth/verify', element: <AuthEl type='verify' /> },
            { path: '/auth/reset', element: <AuthEl type='reset' /> },
        ],
    },
    {
        id: 'signout',
        path: '/auth/signout',
        loader: async () => {
            await handleSignout();
            return redirect('/auth/signin');
        },
    },
]);

export default function Router() {
    return <RouterProvider router={router} />;
}