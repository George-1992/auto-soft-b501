import HandleAiChatRequest from '#src/services/ai/aiSdk.js';
import { createJwtToken } from '#src/services/jwt.service.js';
import { logger } from '#src/utils/logger.js';
import bcrypt from 'bcrypt';
import webPush from 'web-push';
import Prisma from '#src/db/prisma/index.js';
import { nanoid } from 'nanoid';
import { TestFunc } from '#src/services/test.js';
import { getRandomSku, getRandomString } from '#src/services/other.js';
import { aiStream } from '#src/services/ai/streamV2.js';
import { createPartsSearchTool } from '#src/services/ai/tools.js';

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
};
const makeDataItems = (data, workspace, isAuthRequest = false) => {
    try {
        if (!isAuthRequest) {
            if (!workspace || !workspace.id) {
                logger.error('makeDataItems: workspace is missing or invalid:', workspace);
                return [];
            }
        }

        const items = [];
        const arr = data
            ? Array.isArray(data) ? data : [data]
            : [];

        for (const item of arr) {
            if (typeof item === 'object') {
                if (isAuthRequest) {
                    items.push({ ...item });
                } else {
                    items.push({ ...item, workspaceId: workspace.id });
                }
            } else if (typeof item === 'string') {
                if (isAuthRequest) {
                    items.push({ id: item });
                } else {
                    items.push({ id: item, workspaceId: workspace.id });
                }
            } else {
                logger.warn('makeDataItems: unknown item type:', item, workspace.id);
            }
        }
        return items;

    } catch (error) {
        logger.error('makeDataItems: error:', error);
        return [];
    }
};
const addIdsToItems = (items, length = 25) => {
    const arr = [];
    for (const { tempId, ...item } of items) {
        let d = {
            ...item,
            id: item.id || nanoid(length),
        };
        if (d.id.includes('tempId')) {
            d.id = nanoid(length);
        }
        arr.push(d);
    }
    return arr;
};

const filtersToPrismaWhere = (filtersArr) => {

    const OPERATORS = {
        equals: (v) => ({ equals: v }),
        not: (v) => ({ not: v }),
        in: (v) => ({ in: Array.isArray(v) ? v : [v] }),
        notIn: (v) => ({ notIn: Array.isArray(v) ? v : [v] }),
        lt: (v) => ({ lt: v }),
        lte: (v) => ({ lte: v }),
        gt: (v) => ({ gt: v }),
        gte: (v) => ({ gte: v }),
        between: (v) => (Array.isArray(v) && v.length === 2 ? { gte: v[0], lte: v[1] } : null),
        contains: (v) => ({ contains: v, mode: 'insensitive' }),
        startsWith: (v) => ({ startsWith: v, mode: 'insensitive' }),
        endsWith: (v) => ({ endsWith: v, mode: 'insensitive' }),
        isNull: () => null, // handled below, needs raw value
        isNotNull: () => null, // handled below
    };

    const nestKey = (key, condition) =>
        key
            .split('.')
            .reverse()
            .reduce((acc, part) => ({ [part]: acc }), condition);

    try {
        const arr = Array.isArray(filtersArr) ? filtersArr : [];
        const conditions = [];

        for (const filter of arr) {
            const { key, operator, value } = filter || {};
            if (!key || !operator) continue;

            let condition;

            if (operator === 'isNull') {
                condition = null;
            } else if (operator === 'isNotNull') {
                condition = { not: null };
            } else if (OPERATORS[operator]) {
                condition = OPERATORS[operator](value);
                if (condition === undefined || condition === null) continue;
            } else {
                logger.warn(`filtersToPrismaWhere: unknown operator "${operator}"`);
                continue;
            }

            conditions.push(nestKey(key, condition));
        }

        return conditions.length ? { AND: conditions } : {};
    } catch (error) {
        logger.error('filtersArrToPrismaWhere: error:', error);
        return {};
    }
};

const extractCreateUpdateAndDeleteItems = (items) => {
    let r = {
        create: [],
        update: [],
        delete: [],
    }
    try {

        // if tempId field exists or id incudes 'tempId', it's a new item to create
        // if its just valid id then update
        // delete items everything else

    } catch (error) {
        logger.error('extractCreateUpdateAndDeleteItems: error:', error);
        return r;
    }
};
const isTempItem = (item) => {
    if (!item || typeof item !== 'object') return false;
    if (item.tempId) return true;
    if (item.id && typeof item.id === 'string' && item.id.includes('tempId')) return true;
    return false;
};
const toOrderLineNestedWriteData = (line) => {
    const {
        tempId,
        order,
        orderId,
        part,
        service,
        createdAt,
        updatedAt,
        provider,
        ...rest
    } = line || {};

    return {
        ...rest,
        quantity: parseFloat(rest.quantity) || 0,
        unitPrice: parseFloat(rest.unitPrice) || 0,
        totalPrice: parseFloat(rest.totalPrice) || 0,
    };
};

const getIncludeObject = (includ = {}) => { }

export const handleAppRequest = async (req, res) => {

    let resObj = {
        success: false,
        message: null,
        data: null,
        status: 'unknown',
    };
    try {

        // logger.info('handleAppRequest: req.body:', req.body);

        const reqObj = req.body || {};
        const itsFor = reqObj.itsFor || '';
        const action = reqObj.action || '';
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
        if (!isAuthRequest && (!account || !account?.id)) {
            resObj.message = 'Account not found';
            resObj.status = 'error';
            return res.json(resObj);
        }
        if (!isAuthRequest && (!workspace || !workspace?.id)) {
            resObj.message = 'Workspace not found';
            resObj.status = 'error';
            return res.json(resObj);
        }
        const items = makeDataItems(reqObj.data, workspace, isAuthRequest) || [];
        const singleItem = items.length === 1 ? items[0] : null;
        const data = reqObj.data || null; //tmp
        const itemsIds = getIdsFromData(items);
        const filters = reqObj.filters || [];
        const include = reqObj.include || {};

        // // ==== TEST =======
        // // === TEST END ====


        /************************
         *  MAIN REQUEST HANDLER
         * 
         * *********************** */
        if (itsFor === 'signup') {
            if (!singleItem) {
                resObj.message = 'Missing data for signup';
                resObj.status = 'error';
                return res.json(resObj);
            }
            const requiredFields = ['email', 'firstName', 'lastName', 'password'];
            let failed = '';
            for (const field of requiredFields) {
                if (!singleItem[field]) {
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
                const hashedPassword = bcrypt.hashSync(singleItem.password, 10);
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
                            id: nanoid(25),
                            email: singleItem.email,
                            firstName: singleItem.firstName,
                            lastName: singleItem.lastName,
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
                            id: nanoid(25),
                            name: `${user.firstName}'s Account`,
                            status: status, // Pending admin approval
                        },
                        select: { id: true },
                    });

                    // 3. Link User to Account (Junction table)
                    await tx.usersAndAccounts.create({
                        data: {
                            id: nanoid(25),
                            userId: user.id,
                            accountId: account.id,
                            role: 'owner', // Default role for the creator
                        },
                    });

                    // 4. Create initial Workspace under the Account
                    const workspace = await tx.workspaces.create({
                        data: {
                            id: nanoid(25),
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

            if (!singleItem) {
                resObj.message = 'Missing data';
                resObj.status = 'error';
                return res.json(resObj);
            }
            const requiredFields = ['email', 'password'];
            let failed = '';
            for (const field of requiredFields) {
                if (!singleItem[field]) {
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
                    email: singleItem.email,
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
            const isPasswordValid = bcrypt.compareSync(singleItem.password, user.password);

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


                const { usersAndAccounts, ...userWithoutRelation } = user;
                const toSendData = {
                    ...userWithoutRelation,
                    role: usersAndAccounts?.[0]?.role || null,
                    account: usersAndAccounts?.[0]?.account || null,
                    workspaces: usersAndAccounts?.[0]?.account?.workspaces || [],
                }

                // test
                resObj.success = true;
                resObj.message = 'Signin successful';
                resObj.status = 'success';
                resObj.token = token;
                resObj.data = toSendData;

                setSessionCookie(res, token);
            }

        } else if (itsFor === 'signout') {
            // Clear the auth cookie
            return clearAuthSuccess(res);

        } else if (itsFor === 'notes') {

            const ids = getIdsFromData(items);
            if (action === 'get') {

                const whereClause = {
                    workspaceId: workspace.id,
                    ...(ids.length > 0 ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { title: { contains: searchQuery, mode: 'insensitive' } },
                            { content: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                };

                const [result, totalCount] = await Promise.all([
                    Prisma.notes.findMany({
                        where: whereClause,
                        orderBy: [
                            { updatedAt: 'desc' },
                            { createdAt: 'desc' },
                        ],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.notes.count({
                        where: whereClause,
                    }),
                ]);


                resObj.success = true;
                resObj.message = 'Notes retrieved successfully';
                resObj.data = result;
                resObj.totalCount = totalCount;
                resObj.status = 'success';

            } else if (action === 'create') {
                // return res.json(resObj);
                const itemsWithIds = addIdsToItems(items);
                const result = await Prisma.notes.createManyAndReturn({
                    data: itemsWithIds,
                    skipDuplicates: true,
                });
                resObj.success = true;
                resObj.message = 'Note created successfully';
                resObj.data = result;
                resObj.status = 'success';

            } else if (action === 'update') {
                // Handle note update logic here
                const result = await Prisma.$transaction(
                    items.map(({ id, title, content }) =>
                        Prisma.notes.update({
                            where: { id, workspaceId: workspace.id },
                            data: { title, content },
                        })
                    )
                );


                resObj.success = true;
                resObj.message = 'Note updated successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'delete') {
                // Handle note deletion logic here
                const result = await Prisma.notes.deleteMany({
                    where: {
                        id: {
                            in: items.map((item) => item.id),
                        },
                        workspaceId: workspace.id, // Enforces workspace isolation
                    },
                });

                resObj.success = true;
                resObj.message = 'Note deleted successfully';
                resObj.data = result;
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
                        currency: data.currency || account.currency,
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
            return HandleAiChatRequest(req, res, account, user, workspace);
        } else if (itsFor === 'ai-search') {
            return aiStream(req, res, {
                account, user, workspace,
                messages: reqObj.data?.messages || [],
                tools: { createPartsSearchTool: createPartsSearchTool({ accountId: account.id, workspaceId: workspace.id }) },
                system: [
                    'You are a parts search assistant inside garage management software.',
                    '',
                    'Work in exactly these steps, in order. Do not skip ahead, do not go back unless the user changes the vehicle or part.',
                    '',
                    'STEP 1: Vehicle.',
                    '- Required: make, model, year. Engine/trim only if the part depends on it (brakes, filters, engine parts, etc.).',
                    '- Read ALL previous messages first and extract anything already stated. Never ask for something already given.',
                    '- If anything required is missing, ask ONE short question for the missing field(s) only. When the answer is a known set, return it as an "options" block.',
                    '- Move to Step 2 as soon as the vehicle is specific enough to identify the part. Do not ask for extra details "just in case".',
                    '',
                    'STEP 2: Part.',
                    '- Identify which part the user needs. If unclear, ask ONE question. If a part needs a variant (front/rear, left/right), ask only that.',
                    '',
                    'STEP 3: Part numbers.',
                    '- Once vehicle and part are known, determine the candidate part numbers.',
                    '- Do NOT ask the user for permission or confirmation. Do not ask "should I search?".',
                    '',
                    'STEP 4: Search.',
                    '- Call createPartsSearchTool with the part numbers in the same turn as Step 3.',
                    '- Then present the results.',
                    '',
                    'Rules:',
                    '- Maximum 2 clarifying questions in total. After that, proceed with the best assumption and state it.',
                    '- Never ask more than one question per message.',
                    '- Never chat, explain, or offer extras. Every message must either ask the next missing field or call the tool.',
                    '- If you cannot determine part numbers with confidence, say so and search by the part name and vehicle instead.',
                ].join('\n'),
            });

        } else if (itsFor === 'locations') {

            if (action === 'get') {
                // Handle location retrieval logic here
                const [result, totalCount] = await Promise.all([
                    Prisma.locations.findMany({
                        where: {
                            workspaceId: workspace.id,
                            ...(itemsIds.length > 0 ? { id: { in: itemsIds } } : {}),
                        },
                        orderBy: [
                            { updatedAt: 'desc' },
                            { createdAt: 'desc' },
                        ],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.locations.count({
                        where: {
                            workspaceId: workspace.id,
                            ...(itemsIds.length > 0 ? { id: { in: itemsIds } } : {}),
                        },
                    }),
                ]);

                resObj.success = true;
                resObj.message = 'Locations retrieved successfully';
                resObj.data = result;
                resObj.totalCount = totalCount;
                resObj.status = 'success';

            } else if (action === 'create') {

                const existing = await Prisma.locations.findMany({
                    where: {
                        workspaceId: workspace.id,
                        OR: items.map(item => ({
                            name: item.name,
                            address: item.address,
                        })),
                    },
                });

                if (existing.length > 0) {
                    resObj.success = false;
                    resObj.message = 'Some locations already exist with the same name and address';
                    resObj.data = existing;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const itemsWithIds = addIdsToItems(items);
                const result = await Prisma.locations.createManyAndReturn({
                    data: itemsWithIds,
                    skipDuplicates: true,
                });

                resObj.success = true;
                resObj.message = 'Location created successfully';
                resObj.data = result;
                resObj.status = 'success';

            } else if (action === 'update') {
                const result = await Prisma.$transaction(
                    items.map(({ id, name, address }) =>
                        Prisma.locations.update({
                            where: { id, workspaceId: workspace.id },
                            data: { name, address },
                        })
                    )
                );

                resObj.success = true;
                resObj.message = 'Location updated successfully';
                resObj.data = result;
                resObj.status = 'success';

            } else if (action === 'delete') {
                const result = await Prisma.locations.deleteMany({
                    where: {
                        id: {
                            in: items.map((item) => item.id),
                        },
                        workspaceId: workspace.id, // Enforces workspace isolation
                    },
                });

                resObj.success = true;
                resObj.message = 'Location deleted successfully';
                resObj.data = result;
                resObj.status = 'success';
            }


        } else if (itsFor === 'customers') {

            const ids = getIdsFromData(items);
            if (action === 'get') {
                const whereClause = {
                    workspaceId: workspace.id,
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

                const [result, totalCount] = await Promise.all([
                    Prisma.customers.findMany({
                        where: whereClause,
                        include: {
                            _count: {
                                select: { vehicles: true },
                            },
                        },
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.customers.count({ where: whereClause }),
                ]);
                const mappedCustomers = result.map(({ _count, ...item }) => ({
                    ...item,
                    vehicleCount: _count?.vehicles || 0,
                }));

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Customers retrieved successfully';
                resObj.data = mappedCustomers;
                resObj.status = 'success';
            } else if (action === 'create') {
                const customerRows = [];
                const vehicleRows = [];

                for (const { vehicles = [], tempId, vehicleCount, ...customer } of items) {
                    const id = nanoid(25);
                    customerRows.push({ ...customer, id, workspaceId: workspace.id });

                    for (const { tempId, ...vehicle } of vehicles) {
                        vehicleRows.push({
                            ...vehicle, customerId: id,
                            workspaceId: workspace.id,
                            // year: parseInt(vehicle.year) || 0,
                            // odometer: parseInt(vehicle.odometer) || 0,
                        });
                    }
                }

                // duplicates inside the payload
                const keys = customerRows.flatMap((c) => [c.email, c.phone]).filter(Boolean);
                if (new Set(keys).size !== keys.length) {
                    return res.json({ success: false, status: 'error', message: 'Duplicate email or phone in request' });
                }

                // duplicates in the DB
                const or = customerRows.flatMap((c) => [
                    ...(c.email ? [{ email: c.email }] : []),
                    ...(c.phone ? [{ phone: c.phone }] : []),
                ]);

                if (or.length) {
                    const existing = await Prisma.customers.findMany({
                        where: { workspaceId: workspace.id, OR: or },
                        select: { email: true, phone: true },
                    });
                    if (existing.length) {
                        return res.json({
                            success: false,
                            status: 'error',
                            message: 'One or more customers already exist with the same email or phone',
                            data: existing,
                        });
                    }
                }

                // console.log(' >>>> customerRows:', customerRows.length);
                // console.log(' >>>> vehicleRows:', vehicleRows.length);

                const [customers, vehicles] = await Prisma.$transaction([
                    Prisma.customers.createManyAndReturn({ data: customerRows }),
                    Prisma.vehicles.createManyAndReturn({ data: vehicleRows }),
                ]);

                resObj.success = true;
                resObj.status = 'success';
                resObj.message = 'Customers created successfully';
                resObj.data = customers

            } else if (action === 'update') {
                const result = await Prisma.$transaction(
                    items.map(({ id, vehicleCount, ...updateData }) =>
                        Prisma.customers.update({
                            where: { id, workspaceId: workspace.id },
                            data: updateData,
                        })
                    )
                );
                resObj.success = true;
                resObj.message = 'Customer updated successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const result = await Prisma.customers.deleteMany({
                    where: {
                        id: { in: items.map((item) => item.id) },
                        workspaceId: workspace.id,
                    },
                });

                if (result.count === 0) {
                    resObj.success = false;
                    resObj.message = 'No customers found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Customer deleted successfully';
                resObj.data = result;
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
                                workspaceId: workspace.id,
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

            const ids = getIdsFromData(items);
            const customerId = singleItem?.customerId || null;
            if (action === 'get') {
                const parsedYear = Number(searchQuery);
                const whereClause = {
                    workspaceId: workspace.id,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { make: { contains: searchQuery, mode: 'insensitive' } },
                            { model: { contains: searchQuery, mode: 'insensitive' } },
                            ...(Number.isFinite(parsedYear) ? [{ year: parsedYear }] : []),
                            { vin: { contains: searchQuery, mode: 'insensitive' } },
                        ].filter(Boolean),
                    } : {}),
                    ...(filters.length ? filtersToPrismaWhere(filters) : {}),
                };

                const [vehicles, totalCount] = await Promise.all([
                    Prisma.vehicles.findMany({
                        where: whereClause,
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                        ...(include ? { include: include } : {})
                    }),
                    Prisma.vehicles.count({ where: whereClause }),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Vehicles retrieved successfully';
                resObj.data = vehicles;
                resObj.status = 'success';

            } else if (action === 'create') {
                const itemsWithIds = addIdsToItems(items);
                const duplicateCheck = await Prisma.vehicles.findMany({
                    where: {
                        workspaceId: workspace.id,
                        OR: itemsWithIds.flatMap((item) => [
                            ...(item.vin ? [{ vin: item.vin }] : []),
                            ...(item.licensePlate ? [{ licensePlate: item.licensePlate }] : []),
                        ]),
                    },
                });

                if (duplicateCheck.length > 0) {
                    resObj.success = false;
                    resObj.message = 'One or more vehicles already exist with the same VIN or license plate';
                    resObj.data = duplicateCheck;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await Prisma.vehicles.createManyAndReturn({
                    data: itemsWithIds,
                    skipDuplicates: true,
                });

                resObj.success = true;
                resObj.message = 'Vehicle created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {
                const result = await Prisma.$transaction(
                    items.map(({ id, ...updateData }) =>
                        Prisma.vehicles.update({
                            where: { id, workspaceId: workspace.id },
                            data: updateData,
                        })
                    )
                );
                resObj.success = true;
                resObj.message = 'Vehicle updated successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const result = await Prisma.vehicles.deleteMany({
                    where: {
                        id: { in: items.map((item) => item.id) },
                        workspaceId: workspace.id,
                    },
                });

                if (result.count === 0) {
                    resObj.success = false;
                    resObj.message = 'No vehicles found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Vehicle deleted successfully';
                resObj.data = result;
                resObj.status = 'success';
            }


        } else if (itsFor === 'services') {

            const ids = getIdsFromData(items);
            if (action === 'get') {
                const buildWhere = {
                    workspaceId: workspace.id,
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
                const itemsWithIds = addIdsToItems(items);
                const duplicateCheck = await Prisma.services.findMany({
                    where: {
                        workspaceId: workspace.id,
                        OR: itemsWithIds.map(item => ({ name: item.name })),
                    },
                });

                if (duplicateCheck.length > 0) {
                    resObj.success = false;
                    resObj.message = 'One or more services already exist with the same name';
                    resObj.data = duplicateCheck;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await Prisma.$transaction(
                    itemsWithIds.map(item => Prisma.services.create({ data: item }))
                );

                resObj.success = true;
                resObj.message = 'Service created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {
                const result = await Prisma.$transaction(
                    items.map(({ id, ...updateData }) =>
                        Prisma.services.update({
                            where: { id, workspaceId: workspace.id },
                            data: updateData,
                        })
                    )
                );
                resObj.success = true;
                resObj.message = 'Service updated successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const result = await Prisma.services.deleteMany({
                    where: {
                        id: { in: items.map((item) => item.id) },
                        workspaceId: workspace.id,
                    },
                });

                if (result.count === 0) {
                    resObj.success = false;
                    resObj.message = 'No services found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Service deleted successfully';
                resObj.data = result;
                resObj.status = 'success';
            }


        } else if (itsFor === 'vehiclesMakes') {
            const ids = getIdsFromData(data);
            // const makesAndModels = await import('../../data/vehicleMakes.json', { with: { type: 'json' } });
            let toSendData = await Prisma.vehicleMakes.findMany({
                where: {
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { name: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                    ...(filters.length ? filtersToPrismaWhere(filters) : {}),
                },
                orderBy: [{ name: 'asc' }],
            });


            resObj.success = true;
            resObj.message = 'Vehicle makes retrieved successfully';
            resObj.data = toSendData;
            resObj.status = 'success';

        } else if (itsFor === 'vehiclesModels') {
            const ids = getIdsFromData(data);
            let toSendData = [];
            toSendData = await Prisma.vehicleModels.findMany({
                where: {
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { name: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                    ...(filters.length ? filtersToPrismaWhere(filters) : {}),
                },
                orderBy: [{ name: 'asc' }],
            });


            resObj.success = true;
            resObj.message = 'Vehicle models retrieved successfully';
            resObj.data = toSendData || [];
            resObj.status = 'success';
        } else if (itsFor === 'orders') {

            const ids = getIdsFromData(items);
            if (action === 'get') {
                const whereCondition = {
                    workspaceId: workspace.id,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { orderNumber: { equals: Number(searchQuery) } },
                            { name: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                };

                const [orders, totalCount] = await Promise.all([
                    Prisma.orders.findMany({
                        where: whereCondition,
                        include: {
                            customer: true,
                            location: true,
                            vehicle: {
                                include: {
                                    make: true,
                                    model: true,
                                }
                            },
                            stage: true,
                            orderLines: true,
                            // ...(singleItem ? {
                            //     customer: true,
                            //     location: true,
                            //     vehicle: true,
                            //     orderLines: true,
                            // } : {}),
                            ...include,
                        },
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.orders.count({ where: whereCondition }),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Orders retrieved successfully';
                resObj.data = orders;
                resObj.status = 'success';
            } else if (action === 'create') {
                const itemsWithIds = addIdsToItems(items);

                const duplicateCheck = await Prisma.orders.findMany({
                    where: {
                        workspaceId: workspace.id,
                        OR: itemsWithIds.map(item => ({
                            locationId: item.locationId,
                            orderNumber: item.orderNumber,
                        })),
                    },
                });

                if (duplicateCheck.length > 0) {
                    resObj.success = false;
                    resObj.message = 'One or more orders already exist for this location and order number';
                    resObj.data = duplicateCheck;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await Prisma.$transaction(
                    itemsWithIds.map(({ orderLines = [], ...item }) => Prisma.orders.create({
                        data: {
                            ...item,
                            orderLines: {
                                create: orderLines.map((line) => ({
                                    ...toOrderLineNestedWriteData(line),
                                })),
                            }
                        },
                        include: {
                            ...include,
                            ...(items.length === 1
                                ? {
                                    customer: true,
                                    location: true,
                                    vehicle: {
                                        include: {
                                            make: true,
                                            model: true,
                                        }
                                    },
                                    orderLines: true,
                                } : {}),
                        },
                    }))
                );


                resObj.success = true;
                resObj.message = 'Order created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {

                const result = await Prisma.$transaction(
                    items.map(({
                        id,
                        orderLines = [],
                        vehicle,
                        service,
                        location,
                        customer,
                        stage,
                        ...updateData
                    }) => {
                        const existing = orderLines.filter((line) => line?.id && !isTempItem(line));
                        const added = orderLines.filter((line) => !line?.id || isTempItem(line));

                        return Prisma.orders.update({
                            where: { id, workspaceId: workspace.id },
                            data: {
                                ...updateData,
                                orderLines: {
                                    // removed in the UI
                                    deleteMany: { id: { notIn: existing.map((line) => line.id) } },
                                    // renamed / reordered (limited to this order's lines)
                                    updateMany: existing.map((line) => ({
                                        where: { id: line.id },
                                        data: {
                                            ...toOrderLineNestedWriteData(line),
                                        },
                                    })),
                                    // new in the UI
                                    create: added.map((line) => ({
                                        ...toOrderLineNestedWriteData(line),
                                    })),
                                },
                            },
                            include: {
                                ...include,
                                ...(items.length === 1
                                    ? {
                                        customer: true,
                                        location: true,
                                        vehicle: {
                                            include: {
                                                make: true,
                                                model: true,
                                            }
                                        },
                                        orderLines: true,
                                    }
                                    : {}
                                ),
                            },

                        });
                    })
                );

                resObj.success = true;
                resObj.message = 'Order updated successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const result = await Prisma.orders.deleteMany({
                    where: {
                        id: { in: items.map((item) => item.id) },
                        workspaceId: workspace.id,
                    },
                });

                if (result.count === 0) {
                    resObj.success = false;
                    resObj.message = 'No orders found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Order deleted successfully';
                resObj.data = result;
                resObj.status = 'success';

            }


        } else if (itsFor === 'pipelines') {

            const ids = getIdsFromData(items);
            if (action === 'get') {
                const whereClause = {
                    workspaceId: workspace.id,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { name: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                    ...(filters.length ? filtersToPrismaWhere(filters) : {}),
                };


                const [result, totalCount] = await Promise.all([
                    Prisma.pipelines.findMany({
                        where: whereClause,
                        include: {
                            stages: {
                                orderBy: [{ position: 'asc' }],
                            },
                        },
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.pipelines.count({ where: whereClause }),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Pipelines retrieved successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'create') {
                const itemsWithIds = addIdsToItems(items);
                const duplicateCheck = await Prisma.pipelines.findMany({
                    where: {
                        workspaceId: workspace.id,
                        OR: itemsWithIds.map(item => ({ name: item.name, active: item.active })),
                    },
                });

                if (duplicateCheck.length > 0) {
                    resObj.success = false;
                    resObj.message = 'One or more pipelines already exist with the same name';
                    resObj.data = duplicateCheck;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                // stages arrive in display order; position = index
                const result = await Prisma.$transaction(
                    itemsWithIds.map(({ stages = [], ...item }) => Prisma.pipelines.create({
                        data: {
                            ...item,
                            stages: {
                                create: stages.map((stage, index) => ({ name: stage.name, position: index })),
                            },
                        },
                        include: {
                            stages: { orderBy: [{ position: 'asc' }] },
                        },
                    }))
                );

                resObj.success = true;
                resObj.message = 'Pipeline created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {

                const result = await Prisma.$transaction(
                    items.map(({ id, stages, createdAt, updatedAt, ...updateData }) => {
                        // stages arrive in display order; position = index
                        const ordered = (stages ?? []).map((stage, index) => ({ ...stage, position: index }));
                        const existing = ordered.filter((stage) => stage?.id && !isTempItem(stage));
                        const added = ordered.filter((stage) => !stage?.id || isTempItem(stage));

                        return Prisma.pipelines.update({
                            where: { id, workspaceId: workspace.id },
                            data: {
                                name: updateData.name,
                                active: updateData.active,
                                ...(Array.isArray(stages) ? {
                                    stages: {
                                        // removed in the UI
                                        deleteMany: { id: { notIn: existing.map((stage) => stage.id) } },
                                        // renamed / reordered (limited to this pipeline's stages)
                                        updateMany: existing.map((stage) => ({
                                            where: { id: stage.id },
                                            data: { name: stage.name, position: stage.position },
                                        })),
                                        // new in the UI
                                        create: added.map((stage) => ({ name: stage.name, position: stage.position })),
                                    },
                                } : {}),
                            },
                            include: {
                                stages: { orderBy: [{ position: 'asc' }] },
                            },
                        });
                    })
                );


                resObj.success = true;
                resObj.message = 'Pipeline updated successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const result = await Prisma.pipelines.deleteMany({
                    where: {
                        id: { in: items.map((item) => item.id) },
                        workspaceId: workspace.id,
                    },
                });

                if (result.count === 0) {
                    resObj.success = false;
                    resObj.message = 'No pipelines found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Pipeline deleted successfully';
                resObj.data = result;
                resObj.status = 'success';
            }

        } else if (itsFor === 'pipelineStages') {

            const ids = getIdsFromData(items);
            const pipelineId = singleItem?.pipelineId || null;
            if (action === 'get') {
                const whereClause = {
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(pipelineId ? { pipelineId } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { name: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                    pipeline: {
                        workspaceId: workspace.id,
                    },
                };

                const [result, totalCount] = await Promise.all([
                    Prisma.pipelineStages.findMany({
                        where: whereClause,
                        include: {
                            pipeline: true,
                        },
                        orderBy: [{ position: 'asc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.pipelineStages.count({ where: whereClause }),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Pipeline stages retrieved successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'create') {
                const itemsWithIds = addIdsToItems(items);
                const duplicateCheck = await Prisma.pipelineStages.findMany({
                    where: {
                        OR: itemsWithIds.map(item => ({
                            pipelineId: item.pipelineId,
                            position: item.position,
                        })),
                        pipeline: {
                            workspaceId: workspace.id,
                        },
                    },
                });

                if (duplicateCheck.length > 0) {
                    resObj.success = false;
                    resObj.message = 'One or more pipeline stages already exist with the same position in the same pipeline';
                    resObj.data = duplicateCheck;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await Prisma.$transaction(
                    itemsWithIds.map(item => Prisma.pipelineStages.create({ data: item }))
                );

                resObj.success = true;
                resObj.message = 'Pipeline stage created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {
                const idToUpdate = singleItem?.id || items[0]?.id;
                if (!idToUpdate) {
                    resObj.success = false;
                    resObj.message = 'Missing pipeline stage id';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const existing = await Prisma.pipelineStages.findUnique({
                    where: { id: idToUpdate },
                    include: { pipeline: true },
                });

                if (!existing || existing.pipeline.workspaceId !== workspace.id) {
                    resObj.success = false;
                    resObj.message = 'Pipeline stage not found in this workspace';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const nextPipelineId = singleItem?.pipelineId || items[0]?.pipelineId || existing.pipelineId;
                const nextPosition = singleItem?.position ?? items[0]?.position ?? existing.position;

                const duplicateCheck = await Prisma.pipelineStages.findFirst({
                    where: {
                        pipelineId: nextPipelineId,
                        position: nextPosition,
                        id: { not: idToUpdate },
                    },
                });

                if (duplicateCheck) {
                    resObj.success = false;
                    resObj.message = 'Pipeline stage already exists with the same position in this pipeline';
                    resObj.data = duplicateCheck;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await Prisma.$transaction(
                    items.map(({ id, ...updateData }) =>
                        Prisma.pipelineStages.update({
                            where: { id },
                            data: updateData,
                        })
                    )
                );

                resObj.success = true;
                resObj.message = 'Pipeline stage updated successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const validIds = [];
                for (const item of items) {
                    const stage = await Prisma.pipelineStages.findUnique({
                        where: { id: item.id },
                        include: { pipeline: true },
                    });
                    if (stage && stage.pipeline.workspaceId === workspace.id) {
                        validIds.push(item.id);
                    }
                }

                if (validIds.length === 0) {
                    resObj.success = false;
                    resObj.message = 'No pipeline stages found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await Prisma.pipelineStages.deleteMany({
                    where: {
                        id: { in: validIds },
                    },
                });

                resObj.success = true;
                resObj.message = 'Pipeline stage deleted successfully';
                resObj.data = result;
                resObj.status = 'success';
            }

        } else if (itsFor === 'parts') {

            const ids = getIdsFromData(items);

            if (action === 'get') {
                const whereClause = {
                    workspaceId: workspace.id,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { sku: { contains: searchQuery, mode: 'insensitive' } },
                            { name: { contains: searchQuery, mode: 'insensitive' } },
                            { brand: { contains: searchQuery, mode: 'insensitive' } },
                            { description: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                    ...(filters.length ? filtersToPrismaWhere(filters) : {}),
                };

                const [parts, totalCount] = await Promise.all([
                    Prisma.parts.findMany({
                        where: whereClause,
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.parts.count({ where: whereClause }),
                ]);

                resObj.totalCount = totalCount;
                resObj.success = true;
                resObj.message = 'Parts retrieved successfully';
                resObj.data = parts;
                resObj.status = 'success';

            } else if (action === 'create') {
                const itemsWithIds = addIdsToItems(items).map((item) => ({
                    ...item,
                    sku: item.sku ?? getRandomSku(),
                    purchasePrice: Number(item.purchasePrice ?? 0),
                    price: Number(item.price ?? 0),
                    quantity: Number(item.quantity ?? 0),
                }));

                const duplicateCheck = await Prisma.parts.findMany({
                    where: {
                        workspaceId: workspace.id,
                        OR: itemsWithIds.map(item => ({ sku: item.sku })),
                    },
                });

                if (duplicateCheck.length > 0) {
                    resObj.success = false;
                    resObj.message = 'One or more parts already exist with the same SKU';
                    resObj.data = duplicateCheck;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                const result = await Prisma.$transaction(
                    itemsWithIds.map(item => Prisma.parts.create({ data: item }))
                );

                resObj.success = true;
                resObj.message = 'Part created successfully';
                resObj.data = result;
                resObj.status = 'success';

            } else if (action === 'update') {
                const result = await Prisma.$transaction(
                    items.map(({ id, ...updateData }) => {
                        const normalized = { ...updateData };

                        if ('price' in normalized) normalized.price = Number(normalized.price ?? 0);
                        if ('quantity' in normalized) normalized.quantity = Number(normalized.quantity ?? 0);

                        return Prisma.parts.update({
                            where: { id, workspaceId: workspace.id },
                            data: normalized,
                        });
                    })
                );

                resObj.success = true;
                resObj.message = 'Part updated successfully';
                resObj.data = result;
                resObj.status = 'success';

            } else if (action === 'delete') {
                const result = await Prisma.parts.deleteMany({
                    where: {
                        id: { in: items.map((item) => item.id) },
                        workspaceId: workspace.id,
                    },
                });

                if (result.count === 0) {
                    resObj.success = false;
                    resObj.message = 'No parts found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Part deleted successfully';
                resObj.data = result;
                resObj.status = 'success';
            }

        } else if (itsFor === 'appointments') {
            const ids = getIdsFromData(items);
            if (action === 'get') {
                const parsedOrderNumber = Number(searchQuery);
                const whereClause = {
                    workspaceId: workspace.id,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { notes: { contains: searchQuery, mode: 'insensitive' } },
                            { customer: { firstName: { contains: searchQuery, mode: 'insensitive' } } },
                            { customer: { lastName: { contains: searchQuery, mode: 'insensitive' } } },
                            { order: { name: { contains: searchQuery, mode: 'insensitive' } } },
                            ...(Number.isFinite(parsedOrderNumber) ? [{ order: { orderNumber: parsedOrderNumber } }] : []),
                        ],
                    } : {}),
                    ...(filters.length ? filtersToPrismaWhere(filters) : {}),
                };

                const [result, totalCount] = await Promise.all([
                    Prisma.appointments.findMany({
                        where: whereClause,
                        include: include,
                        orderBy: [{ startTime: 'asc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.appointments.count({ where: whereClause }),
                ]);

                resObj.success = true;
                resObj.message = 'Appointments retrieved successfully';
                resObj.data = result;
                resObj.totalCount = totalCount;
                resObj.status = 'success';
            } else if (action === 'create') {
                const itemsWithIds = addIdsToItems(items);
                const result = await Prisma.$transaction(
                    itemsWithIds.map(item => Prisma.appointments.create({
                        data: item,
                        include: include,
                    }))
                );

                resObj.success = true;
                resObj.message = 'Appointment created successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'update') {
                const result = await Prisma.$transaction(
                    items.map(({ id, ...updateData }) =>
                        Prisma.appointments.update({
                            where: { id, workspaceId: workspace.id },
                            data: updateData,
                            include: include,
                        })
                    )
                );

                resObj.success = true;
                resObj.message = 'Appointment updated successfully';
                resObj.data = result;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const result = await Prisma.appointments.deleteMany({
                    where: {
                        id: { in: items.map((item) => item.id) },
                        workspaceId: workspace.id,
                    },
                });

                if (result.count === 0) {
                    resObj.success = false;
                    resObj.message = 'No appointments found to delete';
                    resObj.data = null;
                    resObj.status = 'error';
                    return res.json(resObj);
                }

                resObj.success = true;
                resObj.message = 'Appointment deleted successfully';
                resObj.data = result;
                resObj.status = 'success';
            }
        }
        else if (itsFor === 'test2') {
            return await TestFunc({ req, res });
        }
        else {
            logger.warn(`handleAppRequest: invalid itsFor: ${itsFor}`);
            resObj.message = 'invalid request:itsFor';
            resObj.status = 'error';
        }






        // resObj.account = {
        //     id: account.id,
        //     name: account.name,
        //     currency: account.currency,
        // };
        // resObj.workspace = {
        //     id: workspace.id,
        //     name: workspace.name,
        //     currency: workspace.currency,
        // };
        // resObj.user = {
        //     id: user.id,
        //     name: user.name,
        //     email: user.email,
        // };

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
const dummyCustomersCreation = async ({ count, workspaceId }) => {
    try {
        const dummyCustomers = [];
        const thisButchStr = randomString(8);

        for (let i = 0; i < count; i++) {
            dummyCustomers.push({
                firstName: 'Customer_' + (i + 1) + '_' + thisButchStr,
                lastName: `Last_${i + 1}_${thisButchStr}`,
                email: `customer${i + 1}_${thisButchStr}@example.com`,
                workspaceId,
            });
        }
        await Prisma.customers.createMany({ data: dummyCustomers });
        return Prisma.customers.findMany({
            where: {
                workspaceId,
                email: {
                    in: dummyCustomers.map((item) => item.email),
                },
            },
        });


    } catch (error) {
        logger.error('dummyCustomersCreation error:', error);
    }
};