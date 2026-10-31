import HandleAiRequest from '#src/services/ai/aiSdk.js';
import { createJwtToken } from '#src/services/jwt.service.js';
import { logger } from '#src/utils/logger.js';
import bcrypt from 'bcrypt';
import webPush from 'web-push';
import makesAndModels from '../../data/vehicleMakes.json' with { type: 'json' };
import Prisma from '#src/db/prisma/index.js';


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

            account = await Prisma.accounts.findUnique({
                where: { id: accountId },
                include: {
                    workspaces: true,
                },
            });
            console.log('>>>>>>>>>>>> account:', account);

            if (!account) {
                resObj.message = 'Account not found';
                resObj.status = 'error';
                return res.json(resObj);
            }

            user = await Prisma.users.findUnique({
                where: { id: userId },
                include: {
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

        // // ==== TEST =======

        // const workspaces = await db.query.workspacesTable.findMany({
        //     where: {
        //         accountId: accountId,
        //     },
        //     with: {
        //         notes: true
        //     }
        // });
        // console.log('handleAppRequest: workspaces:', workspaces);

        // // === TEST END ====



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
                const existingAccountsCount = await Prisma.accounts.count();
                const hashedPassword = bcrypt.hashSync(data.password, 10);
                const status = existingAccountsCount === 0 ? 'active' : 'pending'; // First account is active, others are pending

                // console.log('handleAppRequest: :', {
                //     existingAccountsCount,
                //     status,
                // });

                // Handle user creation logic here
                const result = await Prisma.$transaction(async (tx) => {
                    // 1. Create the primary User
                    const user = await tx.users.create({
                        data: {
                            email: data.email,
                            firstName: data.firstName,
                            lastName: data.lastName,
                            password: hashedPassword,
                            status: status, // Account under review status
                        },
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            status: true,
                        },
                    });

                    // 2. Create the Account (Organization / Tenant)
                    const account = await tx.accounts.create({
                        data: {
                            name: `${user.firstName}'s Account`,
                            status: status, // Pending admin approval
                        },
                        select: { id: true },
                    });

                    // 3. Link User to Account (Junction table)
                    await tx.usersAndAccounts.create({
                        data: {
                            userId: user.id,
                            accountId: account.id,
                            role: 'owner', // Default role for the creator
                        },
                    });

                    // 4. Create initial Workspace under the Account
                    const workspace = await tx.workspaces.create({
                        data: {
                            accountId: account.id,
                            name: 'Default Workspace',
                        },
                        select: { id: true },
                    });

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
            const user = await Prisma.users.findFirst({
                where: {
                    email: data.email,
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
                const notes = await Prisma.notes.findMany({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                    },
                    orderBy: [
                        { updatedAt: 'desc' },
                        { createdAt: 'desc' },
                    ],
                    take: limit,
                    skip: offset,
                });

                resObj.success = true;
                resObj.message = 'Notes retrieved successfully';
                resObj.data = notes;
                resObj.status = 'success';
            } else if (action === 'create') {
                // Handle note creation logic here
                const created = await Prisma.notes.create({
                    data,
                });
                resObj.success = true;
                resObj.message = 'Note created successfully';
                resObj.data = [created];
                resObj.status = 'success';
            } else if (action === 'update') {
                // Handle note update logic here
                const { id, ...updateData } = data;
                await Prisma.notes.updateMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                    data: updateData,
                });
                const updated = await Prisma.notes.findMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                resObj.success = true;
                resObj.message = 'Note updated successfully';
                resObj.data = updated;
                resObj.status = 'success';
            } else if (action === 'delete') {
                // Handle note deletion logic here
                const response = await Prisma.notes.findMany({
                    where: {
                        id: data.id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                await Prisma.notes.deleteMany({
                    where: {
                        id: data.id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
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
                const user = await Prisma.users.findFirst({
                    where: {
                        id: userId,
                        status: 'active',
                    },
                    select: {
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

                const updated = await Prisma.users.update({
                    where: { id: userId },
                    data: updateData,
                    select: {
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

                if (!updated) {
                    resObj.message = 'Profile update failed';
                    resObj.status = 'error';
                    res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Profile updated successfully';
                resObj.data = updated;
                resObj.status = 'success';
            } else if (action === 'password') {
                const nextPassword = data.password || '';

                if (!nextPassword) {
                    resObj.message = 'Password is required';
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const hashedPassword = bcrypt.hashSync(nextPassword, 10);

                const updated = await Prisma.users.update({
                    where: { id: userId },
                    data: {
                        password: hashedPassword,
                    },
                    select: { id: true },
                });

                if (!updated) {
                    resObj.message = 'Password update failed';
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Password updated successfully';
                resObj.data = {
                    id: updated.id,
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
                await Prisma.accounts.update({
                    where: { id: account.id },
                    data: {
                        name: data.name || account.name,
                        country: data.country || account.country,
                    },
                });

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
                await Prisma.users.update({
                    where: { id: user.id },
                    data: {
                        config: {
                            ...user.config, webpush: data
                        }
                    },
                });

                resObj.success = true;
                resObj.message = 'Webpush config updated successfully';
                resObj.data = data;
                resObj.status = 'success';
            } else if (action === 'delete') {
                // delete user.config.webpush
                await Prisma.users.update({
                    where: { id: user.id },
                    data: {
                        config: {
                            ...user.config, webpush: null
                        }
                    },
                });

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
                    await Prisma.users.update({
                        where: { id: user.id },
                        data: {
                            config: {
                                ...user.config,
                                webpush: updatedSubscriptions
                            }
                        },
                    });
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
                const locations = await Prisma.locations.findMany({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                    },
                    orderBy: [
                        { updatedAt: 'desc' },
                        { createdAt: 'desc' },
                    ],
                    take: limit,
                    skip: offset,
                });

                resObj.success = true;
                resObj.message = 'Locations retrieved successfully';
                resObj.data = locations;
                resObj.status = 'success';
            } else if (action === 'create') {
                // check if location with the same name already exists for the account and workspace
                const existingLocation = await Prisma.locations.findFirst({
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
                const response = await Prisma.locations.create({ data });
                resObj.success = true;
                resObj.message = 'Location created successfully';
                resObj.data = [response];
                resObj.status = 'success';
            } else if (action === 'update') {
                // Handle location update logic here
                const { id, ...updateData } = data;
                await Prisma.locations.updateMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                    data: updateData,
                });
                const response = await Prisma.locations.findMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                resObj.success = true;
                resObj.message = 'Location updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'delete') {
                // Handle location deletion logic here
                const response = await Prisma.locations.findMany({
                    where: {
                        id: data.id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                await Prisma.locations.deleteMany({
                    where: {
                        id: data.id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                resObj.success = true;
                resObj.message = 'Location deleted successfully';
                resObj.data = response;
                resObj.status = 'success';
            }


        } else if (itsFor === 'customers') {

            const ids = getIdsFromData(data);
            if (action === 'get') {
                const buildWhere = {
                    accountId,
                    workspaceId: workspace?.id || null,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { firstName: { contains: searchQuery, mode: 'insensitive' } },
                            { lastName: { contains: searchQuery, mode: 'insensitive' } },
                            { email: { contains: searchQuery, mode: 'insensitive' } },
                            { phone: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                };

                const [customers, totalCount] = await Promise.all([
                    Prisma.customers.findMany({
                        where: buildWhere,
                        include: {
                            _count: {
                                select: { vehicles: true },
                            },
                        },
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.customers.count({ where: buildWhere }),
                ]);

                const mappedCustomers = customers.map((item) => ({
                    ...item,
                    vehicleCount: item._count?.vehicles || 0,
                }));

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Customers retrieved successfully';
                resObj.data = mappedCustomers;
                resObj.status = 'success';
            } else if (action === 'create') {
                // check if already exists either by email or phone
                const existingCustomer = await Prisma.customers.findFirst({
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

                const result = await Prisma.$transaction(async (tx) => {
                    // 1. Insert customer using the transaction instance (tx)
                    const createdCustomer = await tx.customers.create({ data });

                    // 2. Insert related vehicles if present
                    if (data.vehicles && Array.isArray(data.vehicles) && data.vehicles.length > 0) {
                        const vehiclesToInsert = data.vehicles.map((vehicle) => ({
                            ...vehicle,
                            customerId: createdCustomer.id,
                            accountId: accountId,
                            workspaceId: workspace?.id || null,
                        }));

                        await tx.vehicles.createMany({ data: vehiclesToInsert });
                    }

                    return [createdCustomer];
                });

                resObj.success = true;
                resObj.message = 'Customer created successfully';
                resObj.data = result;
                resObj.status = 'success';

            } else if (action === 'update') {
                const { id, ...updateData } = data;
                await Prisma.customers.updateMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                    data: updateData,
                });
                const response = await Prisma.customers.findMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                resObj.success = true;
                resObj.message = 'Customer updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'delete') {

                const idsToDelete = Array.isArray(data)
                    ? data.map(item => typeof item === 'object' && item.id ? item.id : item)
                    : [data.id];

                const response = await Prisma.customers.findMany({
                    where: {
                        id: { in: idsToDelete },
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                await Prisma.customers.deleteMany({
                    where: {
                        id: { in: idsToDelete },
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });

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

                const selectableFields = new Set([
                    'firstName',
                    'lastName',
                    'companyName',
                    'email',
                    'phone',
                    'address',
                    'notes',
                ]);

                const validFields = data
                    .map(field => field.name)
                    .filter(fieldName => selectableFields.has(fieldName));

                const entries = await Promise.all(
                    validFields.map(async (field) => {
                        const rows = await Prisma.customers.findMany({
                            where: {
                                accountId,
                                workspaceId: workspace?.id || null,
                                [field]: { not: null },
                            },
                            select: { [field]: true },
                            distinct: [field],
                        });

                        return [field, rows.map((row) => row[field]).filter((value) => value != null)];
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
                const parsedYear = Number(searchQuery);
                const buildWhere = {
                    accountId,
                    workspaceId: workspace?.id || null,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(customerId ? { customerId } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { make: { contains: searchQuery, mode: 'insensitive' } },
                            { model: { contains: searchQuery, mode: 'insensitive' } },
                            ...(Number.isFinite(parsedYear) ? [{ year: parsedYear }] : []),
                            { vin: { contains: searchQuery, mode: 'insensitive' } },
                        ].filter(Boolean),
                    } : {}),
                };

                const [vehicles, totalCount] = await Promise.all([
                    Prisma.vehicles.findMany({
                        where: buildWhere,
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.vehicles.count({ where: buildWhere }),
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
                const existingVehicle = await Prisma.vehicles.findFirst({
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

                const result = await Prisma.$transaction(async (tx) => {
                    // 1. Insert vehicle using the transaction instance (tx)
                    const createdVehicle = await tx.vehicles.create({ data });
                    return createdVehicle;
                });

                resObj.success = true;
                resObj.message = 'Vehicle created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {
                const { id, ...updateData } = data;
                await Prisma.vehicles.updateMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                    data: updateData,
                });
                const response = await Prisma.vehicles.findMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                resObj.success = true;
                resObj.message = 'Vehicle updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            }


        } else if (itsFor === 'services') {

            const ids = getIdsFromData(data);
            if (action === 'get') {
                const buildWhere = {
                    accountId,
                    workspaceId: workspace?.id || null,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { name: { contains: searchQuery, mode: 'insensitive' } },
                            { description: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                };

                const [services, totalCount] = await Promise.all([
                    Prisma.services.findMany({
                        where: buildWhere,
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.services.count({ where: buildWhere }),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Services retrieved successfully';
                resObj.data = services;
                resObj.status = 'success';
            } else if (action === 'create') {
                const alreadyExists = await Prisma.services.findFirst({
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

                const result = await Prisma.$transaction(async (tx) => {
                    // 1. Insert service using the transaction instance (tx)
                    const createdService = await tx.services.create({ data });
                    return createdService;
                });

                resObj.success = true;
                resObj.message = 'Service created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {

                const existingService = await Prisma.services.findFirst({
                    where: {
                        accountId: accountId,
                        workspaceId: workspace?.id || null,
                        name: data.name,
                        id: { not: data.id }, // Exclude the current service being updated
                    },
                });

                if (existingService) {
                    resObj.success = false;
                    resObj.message = 'Service already exists with the same name';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const { id, ...updateData } = data;
                await Prisma.services.updateMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                    data: updateData,
                });
                const response = await Prisma.services.findMany({
                    where: {
                        id,
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                resObj.success = true;
                resObj.message = 'Service updated successfully';
                resObj.data = response;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const idsToDelete = Array.isArray(data)
                    ? data.map(item => typeof item === 'object' && item.id ? item.id : item)
                    : [data.id];

                const response = await Prisma.services.findMany({
                    where: {
                        id: { in: idsToDelete },
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });
                await Prisma.services.deleteMany({
                    where: {
                        id: { in: idsToDelete },
                        accountId,
                        workspaceId: workspace?.id || null,
                    },
                });

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
        resObj.message = error.message ? `ERROR: ${error.message}` : 'An error occurred while processing the request';
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
        await Prisma.customers.createMany({ data: dummyCustomers });
        return Prisma.customers.findMany({
            where: {
                accountId,
                workspaceId,
                email: {
                    in: dummyCustomers.map((item) => item.email),
                },
            },
        });


    } catch (error) {
        logger.error('dummyCustomersCreation error:', error);
    }
}