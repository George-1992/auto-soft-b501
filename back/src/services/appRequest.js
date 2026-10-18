import db, { desc, getErrorMessage } from '#src/db/index.js';
import {
    accountsTable, notesTable,
    usersAndAccountsTable, usersTable, workspacesTable
} from '#src/db/schema.js';
import HandleAiRequest from '#src/services/ai/aiSdk.js';
import { createJwtToken } from '#src/services/jwt.service.js';
import { logger } from '#src/utils/logger.js';
import bcrypt from 'bcrypt';
import { and, eq } from 'drizzle-orm';
import webPush from 'web-push';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const IS_PROD = process.env.NODE_ENV === 'production';

const authCookieOptions = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
};

export const handleAppRequest = async (req, res) => {

    let resObj = {
        success: false,
        message: null,
        data: null,
        status: 'unknown',
    };
    try {

        // logger.info('handleAppRequest:called with reqObj:', reqObj);

        const reqObj = req.body || {};
        const itsFor = reqObj.itsFor || '';
        const action = reqObj.action || '';
        const data = reqObj.data || {};

        const accountId = reqObj?.auth?.accountId || null;
        const userId = reqObj?.auth?.userId || null;
        const isAuthRequest = ['signup', 'signin', 'signout'].includes(itsFor);
        let account = null;
        let user = null;
        let workspace = null;

        // optional vars
        const offset = data.startIndex || 0;
        const limit = data.pageSize || 50;

        if (!itsFor) {
            resObj.message = 'Missing itsFor in request';
            resObj.status = 'error';
            return res.json(resObj);
        };
        if (!isAuthRequest) {
            if (!accountId) {
                resObj.message = 'Missing accountId in request';
                resObj.status = 'error';
                return res.json(resObj);
            }
            if (!userId) {
                resObj.message = 'Missing userId in request';
                resObj.status = 'error';
                return res.json(resObj);
            }

            account = await db.query.accountsTable.findFirst({
                where: {
                    id: accountId,
                },
                with: {
                    workspaces: true,
                },
            });

            if (!account) {
                resObj.message = 'Account not found';
                resObj.status = 'error';
                return res.json(resObj);
            }

            user = await db.query.usersTable.findFirst({
                where: { id: userId },
                with: {
                    usersAndAccounts: {
                        where: { accountId },
                    },
                },
            });

            if (!user) {
                resObj.message = 'User not found';
                resObj.status = 'error';
                return res.json(resObj);
            }
            user.role = user.usersAndAccounts?.[0]?.role || null;
            workspace = account?.workspaces?.[0] || null;
        }

        // logger.info('handleAppRequest: account:', account);


        if (itsFor === 'signup') {
            const requiredFields = ['email', 'firstName', 'lastName', 'password'];
            let failed = '';
            for (const field of requiredFields) {
                if (!data[field]) {
                    failed = `Missing required field: ${field}`;
                    break;
                }
            };
            if (failed) {
                resObj.message = failed;
                resObj.status = 'error';
                return res.json(resObj);
            } else {
                const hashedPassword = bcrypt.hashSync(data.password, 10);
                logger.info('handleAppRequest: hashedPassword:', hashedPassword);

                // Handle user creation logic here
                const result = await db.transaction(async (tx) => {
                    // 1. Create the primary User
                    const [user] = await tx
                        .insert(usersTable)
                        .values({
                            email: data.email,
                            firstName: data.firstName,
                            lastName: data.lastName,
                            password: hashedPassword,
                            status: 'pending', // Account under review status
                        })
                        .returning({
                            id: usersTable.id,
                            email: usersTable.email,
                            status: usersTable.status,
                        });

                    // 2. Create the Account (Organization / Tenant)
                    const [account] = await tx
                        .insert(accountsTable)
                        .values({
                            name: `${user.firstName}'s Account`,
                            status: 'inactive', // Pending admin approval
                        })
                        .returning({ id: accountsTable.id });

                    // 3. Link User to Account (Junction table)
                    await tx.insert(usersAndAccountsTable).values({
                        userId: user.id,
                        accountId: account.id,
                        role: 'owner', // Default role for the creator
                    });

                    // 4. Create initial Workspace under the Account
                    const [workspace] = await tx
                        .insert(workspacesTable)
                        .values({
                            accountId: account.id,
                            name: 'Default Workspace',
                        })
                        .returning({ id: workspacesTable.id });

                    // Return the populated objects
                    return {
                        user,
                        accountId: account.id,
                        workspaceId: workspace.id,
                    };
                });

                resObj.success = true;
                resObj.message = 'Signup successful, your account is pending approval';
                // resObj.data = response;
                resObj.status = 'success';
                resObj.data = result;
            }
        } else if (itsFor === 'signin') {
            const requiredFields = ['email', 'password'];
            let failed = '';
            for (const field of requiredFields) {
                if (!data[field]) {
                    failed = `Missing required field: ${field}`;
                    break;
                }
            };

            if (failed) {
                resObj.message = failed;
                resObj.status = 'error';
                return res.json(resObj);
            }

            // see if user exists
            const user = await db.query.usersTable.findFirst({
                where: {
                    email: data.email,
                    status: 'active',
                },
                with: {
                    usersAndAccounts: {
                        with: {
                            account: {
                                with: {
                                    workspaces: true
                                }
                            },
                        },
                    },
                },
            });
            // logger.info('handleAppRequest: signin user found:', user);

            if (!user) {
                resObj.message = 'User not found or Inactive account';
                resObj.status = 'error';
                return res.json(resObj);
            }

            // if no account linked to user, return error
            if (!user.usersAndAccounts || user.usersAndAccounts.length === 0) {
                resObj.message = 'No account linked to this user, please contact support';
                resObj.status = 'error';
                return res.json(resObj);
            };

            // check password
            const isPasswordValid = bcrypt.compareSync(data.password, user.password);

            if (!isPasswordValid) {
                resObj.message = 'Invalid password';
                resObj.status = 'error';
            } else {
                const token = createJwtToken(
                    '7d', // 7 days expiration
                    {
                        accountId: user.usersAndAccounts[0].accountId,
                        userId: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    }
                );
                // console.log('token: ', token);

                // delete password from user object before sending response
                delete user.password;


                // test
                resObj.success = true;
                resObj.message = 'Signin successful';
                resObj.status = 'success';
                resObj.token = token;
                resObj.data = {
                    ...user,
                    account: user.usersAndAccounts[0].account,
                    // user: user,
                    workspaces: user.usersAndAccounts[0].account.workspaces || [],
                };

                setSessionCookie(res, token);
            }

        } else if (itsFor === 'signout') {
            // Clear the auth cookie
            return clearAuthSuccess(res);

        } else if (itsFor === 'notes') {

            data.accountId = accountId;
            data.workspaceId = workspace?.id || null;

            if (action === 'get') {
                const notes = await db.query.notesTable.findMany({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                    },
                    orderBy: {
                        updatedAt: 'desc',
                        createdAt: 'desc',
                    },
                    limit: limit,
                    offset: offset,
                });

                resObj.success = true;
                resObj.message = 'Notes retrieved successfully';
                resObj.data = notes;
                resObj.status = 'success';
            } else if (action === 'create') {
                // Handle note creation logic here
                const response = await db.insert(notesTable).values(data).returning();
                resObj.success = true;
                resObj.message = 'Note created successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'update') {
                // Handle note update logic here
                const response = await db
                    .update(notesTable)
                    .set(data)
                    .where(
                        and(
                            eq(notesTable.id, data.id),
                            eq(notesTable.accountId, accountId),
                            eq(notesTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();
                resObj.success = true;
                resObj.message = 'Note updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'delete') {
                // Handle note deletion logic here
                const response = await db.delete(notesTable)
                    .where(
                        and(
                            eq(notesTable.id, data.id),
                            eq(notesTable.accountId, accountId),
                            eq(notesTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();
                resObj.success = true;
                resObj.message = 'Note deleted successfully';
                resObj.data = response;
                resObj.status = 'success';
            }
        } else if (itsFor === 'profile') {

            const userId = user.id || null;

            if (!userId) {
                resObj.message = 'Missing userId in profile request';
                resObj.status = 'error';
                return res.json(resObj);
            }

            if (action === 'get') {
                const user = await db.query.usersTable.findFirst({
                    where: {
                        id: userId,
                        status: 'active',
                    },
                    columns: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        status: true,
                        provider: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                });

                if (!user) {
                    resObj.message = 'User not found';
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Profile retrieved successfully';
                resObj.data = user;
                resObj.status = 'success';

            } else if (action === 'update') {
                const updateData = {
                    firstName: data.firstName ?? '',
                    lastName: data.lastName ?? '',
                };

                const updated = await db
                    .update(usersTable)
                    .set(updateData)
                    .where(eq(usersTable.id, userId))
                    .returning({
                        id: usersTable.id,
                        email: usersTable.email,
                        firstName: usersTable.firstName,
                        lastName: usersTable.lastName,
                        status: usersTable.status,
                        provider: usersTable.provider,
                        createdAt: usersTable.createdAt,
                        updatedAt: usersTable.updatedAt,
                    });

                if (!updated || updated.length === 0) {
                    resObj.message = 'Profile update failed';
                    resObj.status = 'error';
                    res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Profile updated successfully';
                resObj.data = updated[0];
                resObj.status = 'success';
            } else if (action === 'password') {
                const nextPassword = data.password || '';

                if (!nextPassword) {
                    resObj.message = 'Password is required';
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const hashedPassword = bcrypt.hashSync(nextPassword, 10);

                const updated = await db
                    .update(usersTable)
                    .set({
                        password: hashedPassword,
                    })
                    .where(eq(usersTable.id, userId))
                    .returning({ id: usersTable.id });

                if (!updated || updated.length === 0) {
                    resObj.message = 'Password update failed';
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Password updated successfully';
                resObj.data = {
                    id: updated[0].id,
                };
                resObj.status = 'success';
            } else {
                resObj.message = 'Unknown profile action';
                resObj.status = 'error';
            }
        } else if (itsFor === 'webpush') {
            if (action === 'get') {
                // get user.config.webpush 
                const webpushConfig = user.config?.webpush || null;
                resObj.success = true;
                resObj.message = 'Webpush config retrieved successfully';
                resObj.data = webpushConfig;
                resObj.status = 'success';
            } else if (action === 'update' || action === 'create') {
                // update user.config.webpush
                await db.update(usersTable)
                    .set({
                        config: {
                            ...user.config, webpush: data
                        }
                    })
                    .where((eq(usersTable.id, user.id)));

                resObj.success = true;
                resObj.message = 'Webpush config updated successfully';
                resObj.data = data;
                resObj.status = 'success';
            } else if (action === 'delete') {
                // delete user.config.webpush
                await db.update(usersTable)
                    .set({
                        config: {
                            ...user.config, webpush: null
                        }
                    })
                    .where((eq(usersTable.id, user.id)));

                resObj.success = true;
                resObj.message = 'Webpush config deleted successfully';
                resObj.data = null;
                resObj.status = 'success';
            } else if (action === 'notify') {
                const raw = user.config?.webpush;
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const subscriptions = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

                const dead = [];
                const failed = [];
                const statusCodes = [];
                let sent = 0;

                const payload = JSON.stringify({
                    title: data.title || 'Notification',
                    body: data.body || 'You have a new notification.',
                    icon: data.icon || '/favicon.ico',
                    url: data.url || '/',
                });

                // console.log(' process.env.VAPID_PUBLIC_KEY:', process.env.VAPID_PUBLIC_KEY);
                // console.log(' process.env.VAPID_PRIVATE_KEY:', process.env.VAPID_PRIVATE_KEY);

                await Promise.all(
                    subscriptions.map(async (sub) => {
                        try {
                            const response = await webPush.sendNotification(sub, payload, {
                                vapidDetails: {
                                    subject: process.env.VAPID_SUBJECT,
                                    // subject: 'mailto:example@example.com',
                                    publicKey: process.env.VAPID_PUBLIC_KEY,
                                    privateKey: process.env.VAPID_PRIVATE_KEY,
                                }
                            });

                            // logger.info(`webPush sent:`, response);
                            sent++;
                        } catch (err) {
                            if (err.statusCode === 404 || err.statusCode === 410) {
                                dead.push(sub.endpoint);
                            } else {
                                failed.push({ status: err.statusCode, body: err.body, message: err.message });

                            }
                            statusCodes.push(err.statusCode);
                            logger.error(`webPush failed: ${err.statusCode} ${err.body || err.message}`);
                        }
                    }),
                );


                //  go over errors if expired or unsubscribed, remove from user.config.webpush
                if ([401, 403, 404, 410].some(code => statusCodes.includes(code))) {
                    const updatedSubscriptions = subscriptions.filter(sub => !dead.includes(sub.endpoint));
                    await db.update(usersTable)
                        .set({
                            config: {
                                ...user.config, webpush: null
                            }
                        })
                        .where((eq(usersTable.id, user.id)));
                }

                resObj.success = sent > 0;
                resObj.status = sent > 0 ? 'success' : 'error';
                resObj.message = `Sent ${sent}, dead ${dead.length}, failed ${failed.length}`;
                resObj.errors = failed;
                return res.json(resObj);
            }
        } else if (itsFor === 'ai-chat') {
            return HandleAiRequest(req, res, account, user, workspace);
        } else {
            resObj.message = 'invalid request:itsFor';
            resObj.status = 'error';
        }

    } catch (error) {
        logger.error('handleAppRequest error:', error);
        resObj.success = false;
        resObj.message = getErrorMessage(error) || 'Unknown error';
        resObj.status = error.status || 'error';

        res.status(error.status || 500).json(resObj);
        return;
    }

    // logger.info('handleAppRequest: resObj:', resObj);
    return res.json(resObj);
};


export const setSessionCookie = (res, data) => {
    res.cookie(AUTH_COOKIE_NAME, data, {
        ...authCookieOptions,
        maxAge: 86400 * 1000 * 30, // 30 days  
    });
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
};