import db, { desc, getErrorMessage } from '#src/db/index.js';
import {
    accountsTable, notesTable,
    usersAndAccountsTable, usersTable, workspacesTable,
    locationsTable, customersTable, vehiclesTable,
    servicesTable
} from '#src/db/schema.js';
import HandleAiRequest from '#src/services/ai/aiSdk.js';
import { createJwtToken } from '#src/services/jwt.service.js';
import { logger } from '#src/utils/logger.js';
import bcrypt from 'bcrypt';
import { and, eq, getTableColumns, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import webPush from 'web-push';
import makesAndModels from '../../data/vehicleMakes.json' with { type: 'json' };

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const IS_PROD = process.env.NODE_ENV === 'production';

const authCookieOptions = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
};

const getIdsFromData = (data) => {
    try {
        const ids = [];
        if (Array.isArray(data)) {
            for (const item of data) {
                if (item?.id) {
                    ids.push(item.id);
                }
                if (item?.ids && Array.isArray(item.ids)) {
                    ids.push(...item.ids);
                }
            }
        } else if (data?.id) {
            ids.push(data.id);
        } else if (data?.ids && Array.isArray(data.ids)) {
            ids.push(...data.ids);
        }

        return ids;

    } catch (error) {
        logger.error('getIdsFromData: error:', error);
        return [];
    }
}

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
        const searchQuery = reqObj.searchQuery || '';

        const accountId = reqObj?.auth?.accountId || null;
        const userId = reqObj?.auth?.userId || null;
        const isAuthRequest = ['signup', 'signin', 'signout'].includes(itsFor);
        let account = null;
        let user = null;
        let workspace = null;

        // optional vars
        const offset = reqObj.offset || 0;
        const limit = reqObj.limit || 50;

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

        data.accountId = accountId;
        data.workspaceId = workspace?.id || null;

        // ==== TEST =======

        const workspaces = await db.query.workspacesTable.findMany({
            where: {
                accountId: accountId,
            },
            with: {
                notes: true
            }
        });
        console.log('handleAppRequest: workspaces:', workspaces);

        // === TEST END ====

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
                const existingAccountsCount = await db.$count(accountsTable)
                const hashedPassword = bcrypt.hashSync(data.password, 10);
                const status = existingAccountsCount === 0 ? 'active' : 'pending'; // First account is active, others are pending

                // console.log('handleAppRequest: :', {
                //     existingAccountsCount,
                //     status,
                // });

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
                            status: status, // Account under review status
                        })
                        .returning({
                            id: usersTable.id,
                            firstName: usersTable.firstName,
                            lastName: usersTable.lastName,
                            email: usersTable.email,
                            status: usersTable.status,
                        });

                    // 2. Create the Account (Organization / Tenant)
                    const [account] = await tx
                        .insert(accountsTable)
                        .values({
                            name: `${user.firstName}'s Account`,
                            status: status, // Pending admin approval
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
        } else if (itsFor === 'settings') {
            if (action === 'get') {
                // get user.config.settings 
                resObj.success = true;
                resObj.message = 'Settings config retrieved successfully';
                resObj.data = account;
                resObj.status = 'success';
            } else if (action === 'update' || action === 'create') {
                // update user.config.settings
                await db.update(accountsTable)
                    .set({
                        name: data.name || account.name,
                        country: data.country || account.country,
                    })
                    .where((eq(accountsTable.id, account.id)))
                    .returning();

                resObj.success = true;
                resObj.message = 'Settings config updated successfully';
                resObj.data = {
                    ...account,
                    ...data,
                };
                resObj.status = 'success';
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
        } else if (itsFor === 'locations') {

            if (action === 'get') {
                // Handle location retrieval logic here
                const locations = await db.query.locationsTable.findMany({
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
                resObj.message = 'Locations retrieved successfully';
                resObj.data = locations;
                resObj.status = 'success';
            } else if (action === 'create') {
                // check if location with the same name already exists for the account and workspace
                const existingLocation = await db.query.locationsTable.findFirst({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                        name: data.name,
                    },
                });

                if (existingLocation) {
                    resObj.success = false;
                    resObj.message = 'Location already exists with the same name';
                    resObj.data = existingLocation;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                // Handle location creation logic here
                const response = await db.insert(locationsTable).values(data).returning();
                resObj.success = true;
                resObj.message = 'Location created successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'update') {
                // Handle location update logic here
                const response = await db
                    .update(locationsTable)
                    .set(data)
                    .where(
                        and(
                            eq(locationsTable.id, data.id),
                            eq(locationsTable.accountId, accountId),
                            eq(locationsTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();
                resObj.success = true;
                resObj.message = 'Location updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'delete') {
                // Handle location deletion logic here
                const response = await db.delete(locationsTable)
                    .where(
                        and(
                            eq(locationsTable.id, data.id),
                            eq(locationsTable.accountId, accountId),
                            eq(locationsTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();
                resObj.success = true;
                resObj.message = 'Location deleted successfully';
                resObj.data = response;
                resObj.status = 'success';
            }


        } else if (itsFor === 'customers') {

            const ids = getIdsFromData(data);
            if (action === 'get') {
                const buildWhere = (t) => {
                    return and(
                        eq(t.accountId, accountId),
                        ids.length ? inArray(t.id, ids) : undefined,
                        workspace?.id ? eq(t.workspaceId, workspace.id) : isNull(t.workspaceId),
                        searchQuery
                            ? or(
                                like(t.firstName, `%${searchQuery}%`),
                                like(t.lastName, `%${searchQuery}%`),
                                like(t.email, `%${searchQuery}%`),
                                like(t.phone, `%${searchQuery}%`),
                            )
                            : undefined,
                    );
                };

                const [customers, totalCount] = await Promise.all([
                    db.query.customersTable.findMany({
                        where: { RAW: buildWhere },
                        // with: {
                        //     vehicles: true,
                        // },
                        extras: {
                            vehicleCount: (t) =>
                                sql`(
                                        SELECT COUNT(*) 
                                        FROM ${vehiclesTable} 
                                        WHERE ${vehiclesTable.customerId} = ${t.id}
                                    )`
                                    .mapWith(Number)
                                    .as('vehicleCount'),
                        },
                        orderBy: { updatedAt: 'desc', createdAt: 'desc' },
                        limit,
                        offset,
                    }),
                    db.$count(customersTable, buildWhere(customersTable)),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Customers retrieved successfully';
                resObj.data = customers;
                resObj.status = 'success';
            } else if (action === 'create') {
                // check if already exists either by email or phone
                const existingCustomer = await db.query.customersTable.findFirst({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                        OR: [
                            { email: data.email },
                            { phone: data.phone },
                        ],
                    },
                });

                if (existingCustomer) {
                    resObj.success = false;
                    resObj.message = 'Customer already exists with the same email or phone';
                    resObj.data = existingCustomer;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                // if (!IS_PROD) {
                //     dummyCustomersCreation({ count: 1000, accountId: accountId, workspaceId: workspace?.id || null });
                // }

                const result = await db.transaction(async (tx) => {
                    // 1. Insert customer using the transaction instance (tx)
                    const response = await tx.insert(customersTable).values(data).returning();
                    const createdCustomer = response[0];

                    // 2. Insert related vehicles if present
                    if (data.vehicles && Array.isArray(data.vehicles) && data.vehicles.length > 0) {
                        const vehiclesToInsert = data.vehicles.map((vehicle) => ({
                            ...vehicle,
                            customerId: createdCustomer.id,
                            accountId: accountId,
                            workspaceId: workspace?.id || null,
                        }));

                        await tx.insert(vehiclesTable).values(vehiclesToInsert);
                    }

                    return response;
                });

                resObj.success = true;
                resObj.message = 'Customer created successfully';
                resObj.data = result;
                resObj.status = 'success';

            } else if (action === 'update') {
                const response = await db
                    .update(customersTable)
                    .set(data)
                    .where(
                        and(
                            eq(customersTable.id, data.id),
                            eq(customersTable.accountId, accountId),
                            eq(customersTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();
                resObj.success = true;
                resObj.message = 'Customer updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'delete') {

                const idsToDelete = Array.isArray(data)
                    ? data.map(item => typeof item === 'object' && item.id ? item.id : item)
                    : [data.id];

                const response = await db.delete(customersTable)
                    .where(
                        and(
                            inArray(customersTable.id, idsToDelete),
                            eq(customersTable.accountId, accountId),
                            eq(customersTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();

                if (response.length === 0) {
                    resObj.success = false;
                    resObj.message = 'No customers found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                // console.log('handleAppRequest: delete customers response:', response);

                resObj.success = true;
                resObj.message = 'Customer deleted successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'uniques') {

                const columns = getTableColumns(customersTable);

                const validFields = data
                    .map(field => field.name)
                    .filter(fieldName => fieldName in columns);

                const entries = await Promise.all(
                    validFields.map(async (field) => {
                        const rows = await db
                            .selectDistinct({ value: columns[field] })
                            .from(customersTable)
                            .where(and(
                                eq(customersTable.accountId, accountId),
                                workspace?.id
                                    ? eq(customersTable.workspaceId, workspace.id)
                                    : isNull(customersTable.workspaceId),
                                isNotNull(columns[field])
                            ));

                        return [field, rows.map(row => row.value)];
                    })
                );

                const uniqueValuesObject = Object.fromEntries(entries);

                resObj.success = true;
                resObj.message = 'Unique values retrieved successfully';
                resObj.data = uniqueValuesObject;
                resObj.status = 'success';



            }


        } else if (itsFor === 'vehicles') {

            const ids = getIdsFromData(data);
            const customerId = data.customerId || null;

            if (action === 'get') {
                const buildWhere = (t) => {
                    return and(
                        eq(t.accountId, accountId),
                        ids.length ? inArray(t.id, ids) : undefined,
                        customerId ? eq(t.customerId, customerId) : undefined,
                        workspace?.id ? eq(t.workspaceId, workspace.id) : isNull(t.workspaceId),
                        searchQuery
                            ? or(
                                like(t.make, `%${searchQuery}%`),
                                like(t.model, `%${searchQuery}%`),
                                like(t.year, `%${searchQuery}%`),
                                like(t.vin, `%${searchQuery}%`),
                            )
                            : undefined,
                    );
                };

                const [vehicles, totalCount] = await Promise.all([
                    db.query.vehiclesTable.findMany({
                        where: { RAW: buildWhere },
                        orderBy: { updatedAt: 'desc', createdAt: 'desc' },
                        limit,
                        offset,
                    }),
                    db.$count(vehiclesTable, buildWhere(vehiclesTable)),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Vehicles retrieved successfully';
                resObj.data = vehicles;
                resObj.status = 'success';

            } else if (action === 'create') {
                // check if already exists either by vin
                const orConditions = [];
                if (data.vin) {
                    orConditions.push({ vin: data.vin });
                }
                if (data.licensePlate) {
                    orConditions.push({ licensePlate: data.licensePlate });
                }
                const existingVehicle = await db.query.vehiclesTable.findFirst({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                        OR: orConditions.length > 0 ? orConditions : undefined,
                    },
                });

                if (existingVehicle) {
                    resObj.success = false;
                    resObj.message = 'Vehicle already exists with the same VIN';
                    resObj.data = existingVehicle;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await db.transaction(async (tx) => {
                    // 1. Insert vehicle using the transaction instance (tx)
                    const response = await tx.insert(vehiclesTable).values(data).returning();
                    const createdVehicle = response[0];
                    return createdVehicle;
                });

                resObj.success = true;
                resObj.message = 'Vehicle created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {
                const response = await db
                    .update(vehiclesTable)
                    .set(data)
                    .where(
                        and(
                            eq(vehiclesTable.id, data.id),
                            eq(vehiclesTable.accountId, accountId),
                            eq(vehiclesTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();
                resObj.success = true;
                resObj.message = 'Vehicle updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            }


        } else if (itsFor === 'services') {

            const ids = getIdsFromData(data);
            if (action === 'get') {
                const buildWhere = (t) => {
                    return and(
                        eq(t.accountId, accountId),
                        ids.length ? inArray(t.id, ids) : undefined,
                        workspace?.id ? eq(t.workspaceId, workspace.id) : isNull(t.workspaceId),
                        searchQuery
                            ? or(
                                like(t.name, `%${searchQuery}%`),
                                like(t.description, `%${searchQuery}%`),
                            )
                            : undefined,
                    );
                };

                const [services, totalCount] = await Promise.all([
                    db.query.servicesTable.findMany({
                        where: { RAW: buildWhere },
                        orderBy: { updatedAt: 'desc', createdAt: 'desc' },
                        limit,
                        offset,
                    }),
                    db.$count(servicesTable, buildWhere(servicesTable)),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Services retrieved successfully';
                resObj.data = services;
                resObj.status = 'success';
            } else if (action === 'create') {
                const alreadyExists = await db.query.servicesTable.findFirst({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                        name: data.name,
                    },
                });

                if (alreadyExists) {
                    resObj.success = false;
                    resObj.message = 'Service already exists with the same name';
                    resObj.data = alreadyExists;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await db.transaction(async (tx) => {
                    // 1. Insert service using the transaction instance (tx)
                    const response = await tx.insert(servicesTable).values(data).returning();
                    const createdService = response[0];
                    return createdService;
                });

                resObj.success = true;
                resObj.message = 'Service created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {

                const existingService = await db.query.servicesTable.findFirst({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                        name: data.name,
                        id: not(eq(data.id)), // Exclude the current service being updated
                    },
                });

                if (!existingService) {
                    resObj.success = false;
                    resObj.message = 'Service not found or does not exist';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const response = await db
                    .update(servicesTable)
                    .set(data)
                    .where(
                        and(
                            eq(servicesTable.id, data.id),
                            eq(servicesTable.accountId, accountId),
                            eq(servicesTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();
                resObj.success = true;
                resObj.message = 'Service updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const idsToDelete = Array.isArray(data)
                    ? data.map(item => typeof item === 'object' && item.id ? item.id : item)
                    : [data.id];

                const response = await db.delete(servicesTable)
                    .where(
                        and(
                            inArray(servicesTable.id, idsToDelete),
                            eq(servicesTable.accountId, accountId),
                            eq(servicesTable.workspaceId, workspace?.id)
                        )
                    )
                    .returning();

                if (response.length === 0) {
                    resObj.success = false;
                    resObj.message = 'No services found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Service deleted successfully';
                resObj.data = response;
                resObj.status = 'success';
            }


        } else if (itsFor === 'vehiclesMakes') {
            const ids = getIdsFromData(data);
            // const makesAndModels = await import('../../data/vehicleMakes.json', { with: { type: 'json' } });
            let toSendData = makesAndModels.map(item => {
                const { models, ...rest } = item;
                return rest;
            })
            if (ids.length) {
                toSendData = toSendData.filter(item => ids.includes(item.id));
            }

            resObj.success = true;
            resObj.message = 'Vehicle makes retrieved successfully';
            resObj.data = toSendData;
            resObj.status = 'success';
        } else if (itsFor === 'vehiclesModels') {
            const make = data.make || '';
            const ids = getIdsFromData(data);
            let toSendData = [];
            if (make) {
                toSendData = makesAndModels.find(item => {
                    if (item.makeName.toLowerCase() === make.id.toLowerCase()) {
                        return true;
                    } else if (item.id.toLowerCase() === make.id.toLowerCase()) {
                        return true;
                    }
                    return false;
                });
                toSendData = toSendData?.models || [];
            }
            if (ids.length) {
                const allModels = makesAndModels.flatMap(item => item.models || []);
                toSendData = allModels.filter(item => ids.includes(item.id));
            }


            resObj.success = true;
            resObj.message = 'Vehicle models retrieved successfully';
            resObj.data = toSendData || [];
            resObj.status = 'success';
        }
        else {
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


const randomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};
const dummyCustomersCreation = async ({ count, accountId, workspaceId }) => {
    try {
        const dummyCustomers = [];
        const thisButchStr = randomString(8);

        for (let i = 0; i < count; i++) {
            dummyCustomers.push({
                firstName: 'Customer_' + (i + 1) + '_' + thisButchStr,
                lastName: `Last_${i + 1}_${thisButchStr}`,
                email: `customer${i + 1}_${thisButchStr}@example.com`,
                accountId: accountId,
                workspaceId: workspaceId,
            });
        }
        return await db.insert(customersTable).values(dummyCustomers).returning();


    } catch (error) {
        logger.error('dummyCustomersCreation error:', error);
    }
}