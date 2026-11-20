import Prisma from "#src/db/prisma/index.js";
import { createJwtToken, verifyJwtToken } from "#src/services/jwt.service.js";
import { getRequestData } from "#src/services/other/getRequestData.js";
import { logger } from "#src/utils/logger.js";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const IS_PROD = process.env.NODE_ENV === 'production';
const authCookieOptions = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
};

export const getSessionFromRequest = async (req, res) => {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }
    try {
        let data = null;
        if (!req || !req.cookies) {
            resObj.success = false;
            resObj.message = 'Request or cookies not found';
            return resObj;
        }

        //check if the request has a valid auth token in cookies
        const token = req.cookies?.[AUTH_COOKIE_NAME];
        const incomingTokenData = verifyJwtToken(token);
        const itsFor = req?.body?.itsFor || '';


        const accountId = incomingTokenData?.accountId || null;
        const userId = incomingTokenData?.userId || null;
        // logger.info({ accountId, userId });

        if (!accountId || !userId) {
            resObj.success = false;
            resObj.message = 'Invalid or missing account or user data';
            logger.warn('Invalid or missing account or user data:', { accountId, userId });
            return resObj;
        };


        // find user and account in the database
        const account = await Prisma.accounts.findUnique({
            where: { id: accountId },
            include: {
                workspaces: true,
            },
        });

        if (!account) {
            resObj.message = 'Account not found';
            resObj.success = false;
            resObj.status = 'error';
            logger.warn('Account not found for accountId:', accountId);
            return resObj;
        }

        const user = await Prisma.users.findUnique({
            where: { id: userId },
            include: {
                usersAndAccounts: {
                    where: { accountId },
                },
            },
        });
        if (!user) {
            resObj.message = 'User not found';
            resObj.success = false;
            resObj.status = 'error';
            logger.warn('User not found for userId:', userId);
            return resObj;
        }
        user.role = user.usersAndAccounts?.[0]?.role || null;
        const workspace = account?.workspaces?.[0] || null;

        const requestData = getRequestData(req);
        // logger.info('requestData >>> ', requestData);
        logger.log('requestData >>> ', JSON.stringify(requestData, null, 2));
        // logger.info('incomingTokenData >>> ', incomingTokenData);

        const sessionFromDb = await Prisma.sessions.findFirst({
            where: {
                accountId: accountId,
                userId: userId,
                deviceName: requestData?.device?.name || null,
                deviceType: requestData?.device?.type || null,
                deviceOS: requestData?.device?.os || null,
                deviceBrowser: requestData?.device?.browser || null,
                userAgent: requestData?.userAgent || null,
                ipAddress: requestData?.ipAddress || null,
                country: requestData?.country || null,
            },
        });
        // logger.info('sessionFromDb >>> ', sessionFromDb);
        if (!sessionFromDb) {
            resObj.message = 'Session not found';
            resObj.success = false;
            resObj.status = 'error';
            logger.warn('Session not found for accountId and userId:', { accountId, userId });
            return resObj;
        }

        resObj.success = true;
        resObj.message = 'Session retrieved successfully';
        resObj.data = {
            account: account,
            user: user,
            workspace: workspace,
            session: sessionFromDb,
            tokenData: incomingTokenData,
        };


        // extend the session cookie if the session is valid and not expired
        // by 30 days from now
        if (incomingTokenData) {
            const newToken = extendSessionCookie(res, incomingTokenData);
            //update session's lastActiveAt and expires in the database
            // logger.info('token >>> ', token);
            // logger.info('newToken >>> ', newToken);
            // logger.info('itsFor >>> ', itsFor);
            // logger.info('isTheSameToken >>> ', token === newToken);

            try {
                const randomDelay = Math.floor(Math.random() * 100); // random delay between 0 and 1000 ms
                setTimeout(async () => {
                    await Prisma.sessions.update({
                        where: { id: sessionFromDb.id },
                        data: {
                            sessionToken: newToken,
                            lastActiveAt: new Date(),
                            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // extend expiration by 30 days
                        },
                    });
                }, randomDelay);
            } catch (error) {
                logger.error('Error updating session in database:', error?.message || error);
            }
        }
        // update session's lastActiveAt in the database
        await Prisma.sessions.update({
            where: { id: sessionFromDb.id },
            data: {
                lastActiveAt: new Date(),
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // extend expiration by 30 days
            },
        });


        return resObj;

        const requestUrl = req.originalUrl || req.url || '';
        const xClientUrl = req.headers?.['x-client-url'] || '';

        const reqObj = req.body || {};
        const action = reqObj.action || '';
        const searchQuery = reqObj.searchQuery || '';
        const isAuthRequest = ['signup', 'signin', 'signout'].includes(itsFor);
        let session = null;

        // logger.info('token >>> ', token);
        // logger.info('reqObj >>> ', reqObj);
        // logger.info('requestUrl >>> ', requestUrl);
        // logger.info('Frontend URL >>> ', xClientUrl);

    } catch (error) {
        logger.error('getSessionFromRequest error:', error);
        resObj.success = false;
        resObj.message = 'Error retrieving session from request';
        return resObj;
    }
};

export const createSession = async (req, res, { accountId, userId, token } = {}) => {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }
    try {

        if (!accountId || !userId) {
            resObj.success = false;
            resObj.message = 'Invalid or missing account or user data';
            logger.warn('Invalid or missing account or user data:', { accountId, userId });
            return resObj;
        };

        const requestData = getRequestData(req);
        logger.info('createSession requestData >>> ', JSON.stringify(requestData, null, 2));

        // create a new session in the database
        const newSession = await Prisma.sessions.upsert({
            where: {
                sessionToken: token,
            },
            update: {
                // Keep metadata & activity fresh on existing session
                deviceName: requestData?.device?.name || null,
                deviceType: requestData?.device?.type || null,
                deviceOS: requestData?.device?.os || null,
                deviceBrowser: requestData?.device?.browser || null,
                userAgent: requestData?.userAgent || null,
                ipAddress: requestData?.ipAddress || null,
                country: requestData?.country || null,
                lastActiveAt: new Date(),
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // extend expiration by 30 days
            },
            create: {
                accountId,
                userId,
                sessionToken: token,
                deviceName: requestData?.device?.name || null,
                deviceType: requestData?.device?.type || null,
                deviceOS: requestData?.device?.os || null,
                deviceBrowser: requestData?.device?.browser || null,
                userAgent: requestData?.userAgent || null,
                ipAddress: requestData?.ipAddress || null,
                country: requestData?.country || null,
                lastActiveAt: new Date(),
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // set expiration to 30 days from now
            },
        });


        resObj.success = true;
        resObj.message = 'Session created successfully';
        resObj.data = newSession;
        return resObj;

    } catch (error) {
        logger.error('createSession error:', error);
        resObj.success = false;
        resObj.message = 'Error creating session';
        return resObj;
    }
};



//  =============== helpers for session cookie management ===============
export const setSessionCookie = (res, data) => {
    res.cookie(AUTH_COOKIE_NAME, data, {
        ...authCookieOptions,
        maxAge: 86400 * 1000 * 30, // 30 days  
    });
};
export const extendSessionCookie = (res, data) => {
    const extendedToken = createJwtToken('30d', data);
    setSessionCookie(res, extendedToken);
    return extendedToken;
};
export const clearAuthUnauthorized = (res) => {
    res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions);

    return res.status(401).json({
        success: false,
        status: 'unauthorized',
        message: 'Authentication required',
        data: null,
    });
};
export const clearAuthSuccess = (res) => {
    res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions);

    return res.status(200).json({
        success: true,
        status: 'success',
        message: 'Signed out',
        data: null,
    });
}