export const GLOBALS = {
    PROJECT_NAME: import.meta.env.VITE_PROJECT_NAME || '',
    IS_DEV: import.meta.env.NODE_ENV === 'development',
    LOGO: {
        MAIN: '/images/logo/main.png',
        SMALL: '/images/logo/main.png',
    },
    AUTH_PATHS: ['/auth/signin', '/auth/signup', '/auth/verify', '/auth/reset'],
};