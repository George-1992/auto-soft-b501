/**
 * Internal helpers for consistent URL encoding and decoding
 */
const encode = (value) => encodeURIComponent(value ?? "");
const decode = (value) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value; // Fallback if URI malformed
    }
};

/**
 * Sets a secure cookie.
 * 
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {Object} [options] - Configuration options
 * @param {number} [options.days] - Expiration in days
 * @param {string} [options.path='/'] - Path scope
 * @param {'Strict'|'Lax'|'None'} [options.sameSite='Strict'] - SameSite policy
 * @param {boolean} [options.secure=true] - Require HTTPS
 * @param {string} [options.domain] - Domain scope (Omit for strict host-only cookie)
 */
export const setCookie = (name, value, options = {}) => {
    const {
        days,
        expires,
        path = "/",
        sameSite = "Lax",
        secure = location.protocol === "https:",
        domain
    } = options;

    let cookieString = `${encode(name)}=${encode(value)}`;

    if (expires instanceof Date) {
        cookieString += `; expires=${expires.toUTCString()}`;
    } else if (days) {
        cookieString += `; expires=${new Date(Date.now() + days * 864e5).toUTCString()}`;
    }

    if (path) cookieString += `; path=${path}`;
    if (domain) cookieString += `; domain=${domain}`;
    if (sameSite) cookieString += `; SameSite=${sameSite}`;
    if (secure) cookieString += `; Secure`;

    document.cookie = cookieString;
};

/**
 * Retrieves a cookie value by name.
 * 
 * @param {string} name - Cookie name
 * @returns {string|null} Decoded cookie value or null
 */
export const getCookie = (name) => {
    const encodedNameEQ = `${encode(name)}=`;
    const cookies = document.cookie.split(";");

    for (let c of cookies) {
        c = c.trim();
        if (c.startsWith(encodedNameEQ)) {
            return decode(c.slice(encodedNameEQ.length));
        }
    }
    return null;
};

/**
 * Deletes a cookie by matching name, path, and domain.
 * 
 * @param {string} name - Cookie name
 * @param {Object} [options] - Options must match those used when setting the cookie
 * @param {string} [options.path='/'] - Path scope
 * @param {string} [options.domain] - Domain scope
 */
export const deleteCookie = (name, options = {}) => {
    const { path = "/", domain } = options;

    // Setting expires to epoch time forces deletion
    setCookie(name, "", {
        ...options,
        days: -1,
        path,
        domain
    });
};