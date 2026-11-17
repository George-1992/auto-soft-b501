/**
 * Extracts comprehensive client, device, network, and URL metadata from an HTTP request.
 * Works with Node/Express `IncomingMessage` and Web Fetch API `Request` objects.
 * Alias: getRequestData
 */
export const getRequestData = (req) => {
    try {
        if (!req) return {};

        // Helper to safely read headers regardless of Express object or Fetch Headers instance
        const getHeader = (name) => {
            const key = name.toLowerCase();
            if (typeof req.headers?.get === 'function') {
                return req.headers.get(key) || '';
            }
            return req.headers?.[key] || '';
        };

        // 1. User-Agent & Device Parsing
        const userAgent = getHeader('user-agent');
        const uaLower = userAgent.toLowerCase();

        const isBot = /bot|crawler|spider|crawling|headless|lighthouse/i.test(uaLower);
        const isTablet = /ipad|tablet|(android(?!.*mobile))|kindle|playbook|silk/i.test(uaLower);
        const isMobile = !isTablet && /mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(uaLower);

        let deviceType = 'desktop';
        if (isBot) deviceType = 'bot';
        else if (isTablet) deviceType = 'tablet';
        else if (isMobile) deviceType = 'mobile';

        // OS Detection (prioritizes Client Hints if available)
        let os = getHeader('sec-ch-ua-platform').replace(/"/g, '') || 'unknown';
        if (os === 'unknown') {
            if (/windows/i.test(uaLower)) os = 'Windows';
            else if (/iphone|ipad|ipod/i.test(uaLower)) os = 'iOS';
            else if (/mac os x|macintosh/i.test(uaLower)) os = 'macOS';
            else if (/android/i.test(uaLower)) os = 'Android';
            else if (/linux/i.test(uaLower)) os = 'Linux';
        }

        // Browser Detection
        let browser = 'unknown';
        if (/edg\//i.test(uaLower)) browser = 'Edge';
        else if (/opr\/|opera/i.test(uaLower)) browser = 'Opera';
        else if (/chrome|crios/i.test(uaLower)) browser = 'Chrome';
        else if (/firefox|fxios/i.test(uaLower)) browser = 'Firefox';
        else if (/safari/i.test(uaLower) && !/chrome|crios/i.test(uaLower)) browser = 'Safari';

        // 2. Network & IP Resolution (handles proxies, Cloudflare, Vercel, AWS)
        const forwardedFor = getHeader('x-forwarded-for');
        const ip =
            getHeader('cf-connecting-ip') ||
            getHeader('x-real-ip') ||
            (forwardedFor ? forwardedFor.split(',')[0].trim() : '') ||
            req.socket?.remoteAddress ||
            req.ip ||
            'unknown';

        // 3. URL, Protocol & Host Breakdown
        const protocol =
            getHeader('x-forwarded-proto').split(',')[0].trim() ||
            (req.socket?.encrypted ? 'https' : 'http');
        const host = getHeader('x-forwarded-host') || getHeader('host') || 'localhost';
        const rawPath = req.originalUrl || req.url || '/';

        let parsedUrl;
        try {
            // Handle both full URLs (Web Request) and relative paths (Express/Node)
            parsedUrl = rawPath.startsWith('http')
                ? new URL(rawPath)
                : new URL(rawPath, `${protocol}://${host}`);
        } catch {
            parsedUrl = new URL(`http://localhost/`);
        }

        return {
            request: {
                method: req.method || 'GET',
                url: parsedUrl.href,
                protocol: parsedUrl.protocol.replace(':', ''),
                host: parsedUrl.host,
                hostname: parsedUrl.hostname,
                pathname: parsedUrl.pathname,
                search: parsedUrl.search,
                query: Object.fromEntries(parsedUrl.searchParams.entries()),
                referer: getHeader('referer') || null,
                origin: getHeader('origin') || null,
            },
            client: {
                ip,
                language: getHeader('accept-language').split(',')[0]?.trim() || null,
                // Common CDN geolocation headers (Cloudflare / Vercel)
                country: getHeader('cf-ipcountry') || getHeader('x-vercel-ip-country') || null,
                city: getHeader('x-vercel-ip-city') || null,
            },
            device: {
                name: getDeviceName(req),
                type: deviceType,
                isMobile,
                isTablet,
                isDesktop: deviceType === 'desktop',
                isBot,
                os,
                browser,
                userAgent,
            },
            auth: {
                hasAuthorization: Boolean(getHeader('authorization')),
                hasCookies: Boolean(getHeader('cookie')),
            },
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        logger.error('getRequestData error:', error);
        return {}
    }
};


export const getCookiesFromRequest = (req) => {
    try {
        if (!req) return {};

        const cookieHeader = req.headers?.cookie || '';
        const cookies = {};

        cookieHeader.split(';').forEach((cookie) => {
            const [name, ...rest] = cookie.split('=');
            if (!name) return;
            const value = rest.join('=').trim();
            cookies[name.trim()] = decodeURIComponent(value);
        }

        );
        return cookies;
    } catch (error) {
        logger.error('getCookiesFromRequest error:', error);
        return {};
    }
};


/**
 * Extracts a clean, human-readable device name directly from an HTTP request object.
 * Supports Node/Express `IncomingMessage` and Web Fetch `Request` objects.
 */
export const getDeviceName = (req) => {
    try {
        if (!req) return 'unknown';

        // Safely read headers across Express/Node objects and Fetch API Headers
        const getHeader = (name) => {
            const key = name.toLowerCase();
            if (typeof req.headers?.get === 'function') {
                return req.headers.get(key) || '';
            }
            return req.headers?.[key] || '';
        };

        // 1. Check Chromium Client Hints first (gives exact model e.g. "Pixel 8", "SM-S918B")
        const chModel = getHeader('sec-ch-ua-model').replace(/"/g, '').trim();
        if (chModel) return chModel;

        // 2. Fall back to User-Agent parsing
        const userAgent = getHeader('user-agent');
        if (!userAgent) return 'unknown';

        const ua = userAgent.toLowerCase();

        // Bots & Crawlers
        if (/bot|crawler|spider|crawling|headless|lighthouse|pingdom/i.test(ua)) {
            return 'Bot / Crawler';
        }

        // Apple Devices (iPad/iPod must come before Mac)
        if (/ipad/i.test(ua)) return 'iPad';
        if (/iphone/i.test(ua)) return 'iPhone';
        if (/ipod/i.test(ua)) return 'iPod';

        // Consoles, TVs & Wearables (must come before Android/Linux checks)
        if (/playstation 5|ps5/i.test(ua)) return 'PlayStation 5';
        if (/playstation 4|ps4/i.test(ua)) return 'PlayStation 4';
        if (/xbox/i.test(ua)) return 'Xbox';
        if (/nintendo switch/i.test(ua)) return 'Nintendo Switch';
        if (/appletv/i.test(ua)) return 'Apple TV';
        if (/crkey/i.test(ua)) return 'Chromecast';
        if (/roku/i.test(ua)) return 'Roku';
        if (/firetv|aft[a-z0-9]+/i.test(ua)) return 'Amazon Fire TV';
        if (/smart-tv|smarttv|tizen|webos|viera|bravia/i.test(ua)) return 'Smart TV';
        if (/oculus|quest/i.test(ua)) return 'Meta Quest';

        // Android Devices (extracts hardware model when not redacted to "K")
        if (/android/i.test(ua)) {
            const androidMatch = userAgent.match(/Android\s[\d.]+;\s([^;)]+)/i);
            const rawModel = androidMatch?.[1]?.trim();

            if (rawModel && rawModel !== 'K' && !/^(wv|mobile|tablet)$/i.test(rawModel)) {
                return rawModel.replace(/\sBuild\/.*$/i, '').trim();
            }

            return /mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet';
        }

        // Desktop & Laptop OS Fallbacks
        if (/cros/i.test(ua)) return 'Chromebook';
        if (/windows phone/i.test(ua)) return 'Windows Phone';
        if (/windows nt/i.test(ua)) return 'Windows PC';
        if (/macintosh|mac os x/i.test(ua)) return 'Mac';
        if (/ubuntu/i.test(ua)) return 'Ubuntu PC';
        if (/fedora/i.test(ua)) return 'Fedora PC';
        if (/linux/i.test(ua)) return 'Linux PC';

        return 'unknown';
    } catch (error) {
        logger?.error?.('getDeviceName error:', error);
        return 'unknown';
    }
};