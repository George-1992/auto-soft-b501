import { GLOBALS } from '@/globals';
import { auth, handleSignout } from '@/src/components/auth';
import AuthEl from '@/src/components/auth/parts';
import ErrorEl from '@/src/components/ui/errorEl'
import NotFound from '@/src/components/ui/notFound';
import { logger } from '@/src/services/logger';
import { createBrowserRouter, Outlet, redirect, RouterProvider } from 'react-router'
import Header from '@/src/components/ui/header.jsx';
import Sidebar from '@/src/components/ui/sidebar.jsx';
import { setMetas } from '@/src/services/metas';
import Notes from '@/src/pages/notes';
import { BotIcon, HomeIcon, ListChevronsUpDownIcon, NotebookTabsIcon, StretchHorizontalIcon, TestTubeDiagonalIcon } from 'lucide-react';
import ToasterSonnar from '@/src/components/ui/sonnar/sonnar';
import Profile from '@/src/pages/profile';
import Settings from '@/src/pages/settings';
import Home from '@/src/pages/home';
import AiChatPage from '@/src/pages/aiChat';

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
        return redirect(`/auth/signin`);
    }
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
        name: 'Notes',
        icon: (props) => <NotebookTabsIcon {...props} />,
        path: '/notes',
        subItems: []
    },
    {
        name: 'AI Chat',
        icon: (props) => <BotIcon {...props} />,
        path: '/ai-chat',
        subItems: []
    },
    {
        name: 'Test 1',
        icon: (props) => <TestTubeDiagonalIcon {...props} />,
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



const router = createBrowserRouter([
    {
        id: 'root',
        loader: requireAuth,
        errorElement: <ErrorEl />,
        element: (
            <div className='flex w-full h-full'>
                <Sidebar items={sidebarItems} />
                <div className='flex-1 px-4 overflow-auto'>
                    <Header items={[]} />
                    <Outlet />
                </div>
            </div>
        ),
        children: [
            { index: true, element: <Home /> },
            { path: 'notes', element: <Notes /> },
            { path: 'ai-chat', element: <AiChatPage /> },
            { path: 'profile', element: <Profile /> },
            { path: 'settings', element: <Settings /> },
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