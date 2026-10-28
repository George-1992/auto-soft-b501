import { logger } from "@/src/services/logger";
import { cloneDeep } from "lodash";


/**
 * Detects the device category based on the user agent and device capabilities.
 * @returns {'mobile' | 'tablet' | 'desktop'} The detected device category
 */
export const deviceCategory = () => {
    try {
        let d = 'desktop';

        // Guard for SSR environments (Next.js, Nuxt, etc.)
        if (typeof window === 'undefined' || typeof navigator === 'undefined') {
            d = 'desktop';
        }

        const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';

        // iPad detection (modern iPads report as Macintosh with touch support)
        const isIPad = /iPad/.test(userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // Tablet detection (check before mobile, since some tablets match mobile regex)
        const isTablet = isIPad ||
            /Android(?!.*Mobile)/i.test(userAgent) || // Android without "Mobile" = tablet
            /Tablet|PlayBook|Silk/i.test(userAgent) ||
            (/Macintosh/.test(userAgent) && 'ontouchend' in document);

        d = isTablet ? 'tablet' : d;

        // Mobile detection
        const isMobile = /Windows Phone|IEMobile|WPDesktop/i.test(userAgent) ||
            /Android|webOS|BlackBerry|Opera Mini|Opera Mobi|Mobile/i.test(userAgent) ||
            /iPhone|iPod/.test(userAgent);

        d = isMobile ? 'mobile' : d;

        return d;
    } catch (error) {
        logger.error('Error detecting device category:', error);
        return 'desktop'; // Default to desktop on error
    }
};


export const isAuthPath = (path) => {
    try {
        if (!path) {
            logger.info('isAuthPath no path');
            return false;
        }

        if (typeof path !== 'string' || !path.trim()) {
            logger.info('isAuthPath invalid path');
            return false;
        }

        const cleanPath = path.trim().replace(/[/\\]+$/, '');


        //if first level of path is auth, then return true
        const firstLevel = cleanPath.split('/')[1];

        return firstLevel === 'auth';

        // // Define auth paths
        // const authPaths = [
        //     '/auth/signin', '/auth/signup', '/auth/verify', '/auth/reset'
        // ].filter(path => {
        //     if (path === '/auth/signup') {
        //         // return ALLOW_SIGNUP;
        //         return true;
        //     }
        //     return true;
        // });
        // return authPaths.includes(cleanPath);

    } catch (error) {
        logger.error('isAuthPath error ==> ', error);
        return false;
    }
}


export const cn = (...classes) => {
    return classes.filter(Boolean).join(' ');
}

export const toDisplayStr = (value) => {
    try {
        if (!value || typeof value !== 'string') return value;

        // Enhanced camel case handling that works with acronyms and numbers
        value = value
            // Insert space before capital letters (camelCase)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // Insert space after acronyms followed by lowercase
            .replace(/([A-Z])([A-Z])(?=[a-z])/g, '$1 $2')
            // Handle numbers
            .replace(/([a-zA-Z])(\d)/g, '$1 $2')
            .replace(/(\d)([a-zA-Z])/g, '$1 $2');

        // Convert kebab-case and snake_case to spaces
        value = value.replace(/[_-]/g, ' ');

        // Clean up multiple spaces and trim
        value = value.replace(/\s+/g, ' ').trim();

        if (!value) return value;

        // Capitalize first letter of each word
        value = value.replace(/\b\w/g, char => char.toUpperCase());

        return value;
    } catch (error) {
        appConsole.log('toDisplayString error ==> ', error);
        return value;
    }
}

export const clearObjectValues = (obj) => {
    try {
        return clearValue(obj);
    } catch (error) {
        logger.error('clearObjectValues error ==> ', error);
        return obj;
    }
};

const clearValue = (value) => {
    const EMPTY_VALUES = {
        string: '',
        number: 0,
        boolean: false,
        bigint: 0n,
    };
    // Arrays → empty array (preserves "array" type)
    if (Array.isArray(value)) {
        return [];
    }

    // Plain objects → recurse into keys
    if (value !== null && typeof value === 'object' && value.constructor === Object) {
        return Object.fromEntries(
            Object.entries(value).map(([key, val]) => [key, clearValue(val)])
        );
    }

    // Preserve prototype-based objects (class instances, Date, Map, etc.)
    // by returning a shallow clone with cleared primitive props, or null.
    if (value !== null && typeof value === 'object') {
        // Option A: keep the same "shape" for class instances
        const cloned = cloneDeep(value);
        for (const key of Object.keys(cloned)) {
            cloned[key] = clearValue(cloned[key]);
        }
        return cloned;
    }

    // Primitives
    const type = typeof value;
    if (type in EMPTY_VALUES) {
        return EMPTY_VALUES[type];
    }

    // null, undefined, symbol, function → null
    return null;
};