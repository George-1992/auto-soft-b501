import { createJwtToken } from '#src/services/jwt.service.js';
import { logger } from '#src/utils/logger.js';
import bcrypt from 'bcrypt';
import Prisma from '#src/db/prisma/index.js';
import { setSessionCookie, clearAuthUnauthorized, clearAuthSuccess, getSessionFromRequest, createSession } from '#src/services/session.js';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const IS_PROD = process.env.NODE_ENV === 'production';


const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 30;

export const handleSignin = async ({ data, req, res }) => {

    let resObj = {
        success: false,
        message: '',
        status: 'error',
        data: null,
    };

    try {
        if (!data || typeof data !== 'object') {
            resObj.message = 'Missing data';
            return resObj;
        }

        const requiredFields = ['email', 'password'];
        for (const field of requiredFields) {
            if (!data[field]) {
                resObj.message = `Missing required field: ${field}`;
                return resObj;
            }
        }

        const email = data.email.toLowerCase().trim();
        // Extract IP and User-Agent from req (fallback to data if passed there)
        const ip = req?.headers['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || data.ip || null;
        const userAgent = req?.headers['user-agent'] || data.userAgent || null;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + LOCKOUT_WINDOW_MINUTES * 60 * 1000);

        // 1. CHECK FOR ACTIVE BLOCKS / RECENT FAILED ATTEMPTS
        // Check failed attempts matching either this email OR this IP that haven't expired yet
        const recentFailedAttempts = await Prisma.signinAttempts.count({
            where: {
                status: 'failed',
                expires: { gt: now },
                OR: [
                    { email },
                    ...(ip ? [{ ip }] : []),
                ],
            },
        });

        if (recentFailedAttempts >= MAX_ATTEMPTS) {
            // Log the blocked attempt for auditing
            await Prisma.signinAttempts.create({
                data: {
                    email,
                    ip,
                    userAgent,
                    status: 'blocked',
                    expires: expiresAt,
                    reason: 'Max login attempts exceeded',
                },
            });

            resObj.success = false;
            resObj.status = 'blocked';
            resObj.message = `Too many failed login attempts. Please try again in ${LOCKOUT_WINDOW_MINUTES} minutes.`;
            return resObj;
        }

        // 2. FIND USER
        const user = await Prisma.users.findFirst({
            where: {
                email,
                status: 'active',
            },
            include: {
                usersAndAccounts: {
                    include: {
                        account: {
                            include: {
                                workspaces: true,
                            },
                        },
                    },
                },
            },
        });

        const accountId = user?.usersAndAccounts?.[0]?.accountId || null;

        if (!user) {
            // Record failed attempt (user doesn't exist or is inactive)
            await Prisma.signinAttempts.create({
                data: {
                    email,
                    ip,
                    userAgent,
                    status: 'failed',
                    expires: expiresAt,
                    otherDetails: { reason: 'User not found or inactive' },
                },
            });

            // Generic message prevents user enumeration
            resObj.message = 'Invalid email or password';
            return resObj;
        }

        if (!user.usersAndAccounts || user.usersAndAccounts.length === 0) {
            resObj.message = 'No account linked to this user, please contact support';
            return resObj;
        }

        // 3. VERIFY PASSWORD
        const isPasswordValid = bcrypt.compareSync(data.password, user.password);

        if (!isPasswordValid) {
            // Record failed password attempt
            await Prisma.signinAttempts.create({
                data: {
                    email,
                    ip,
                    userAgent,
                    status: 'failed',
                    expires: expiresAt,
                    userId: user.id,
                    accountId,
                    otherDetails: { reason: 'Invalid password' },
                },
            });

            const attemptsLeft = MAX_ATTEMPTS - (recentFailedAttempts + 1);
            resObj.message = attemptsLeft > 0
                ? `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`
                : `Too many failed login attempts. Account locked for ${LOCKOUT_WINDOW_MINUTES} minutes.`;
            return resObj;
        }

        // 4. SUCCESSFUL LOGIN: LOG ATTEMPT & EXPIRE PREVIOUS FAILURES
        await Prisma.$transaction([
            // Expire active failed attempts so the user starts fresh
            Prisma.signinAttempts.updateMany({
                where: {
                    email,
                    status: 'failed',
                    expires: { gt: now },
                },
                data: {
                    status: 'cleared',
                    expires: now,
                },
            }),
            // Record the successful login
            Prisma.signinAttempts.create({
                data: {
                    email,
                    ip,
                    userAgent,
                    status: 'success',
                    expires: expiresAt,
                    userId: user.id,
                    accountId,
                },
            }),
        ]);

        // 5. GENERATE TOKEN & SESSION
        const token = createJwtToken('7d', {
            accountId,
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        });

        delete user.password;
        const { usersAndAccounts, ...userWithoutRelation } = user;

        const signinSession = await createSession(req, res, {
            accountId,
            userId: user.id,
            token,
        });

        if (!signinSession.success) {
            resObj.message = 'Signin session creation failed';
            return resObj;
        }

        setSessionCookie(res, token);

        resObj.success = true;
        resObj.message = 'Signin successful';
        resObj.status = 'success';
        resObj.token = token;
        resObj.data = {
            ...userWithoutRelation,
            role: usersAndAccounts?.[0]?.role || null,
            account: usersAndAccounts?.[0]?.account || null,
            workspaces: usersAndAccounts?.[0]?.account?.workspaces || [],
        };

        return resObj;
    } catch (error) {
        logger.error('handleAppRequest: signin error:', error);
        resObj.success = false;
        resObj.message = 'Signin error';
        resObj.status = 'error';
        return resObj;
    }
};
