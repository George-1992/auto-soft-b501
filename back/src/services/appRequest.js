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
import { createInventoryPartsSearchTool, createVinSearchTool } from '#src/services/ai/tools.js';
import { generateText, Output, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { setSessionCookie, clearAuthUnauthorized, clearAuthSuccess, getSessionFromRequest, createSession } from '#src/services/session.js';
import { google } from '@ai-sdk/google';
import { handleSignin } from '#src/services/app/auth.js';
import { getRequestContext } from '#src/services/app/getRequestContext.js';
import { handleFileRequest } from '#src/services/app/handleFiles.js';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const IS_PROD = process.env.NODE_ENV === 'production';


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



export const handleAppRequest = async (req, res) => {

    let resObj = {
        success: false,
        message: null,
        data: null,
        status: 'unknown',
    };
    try {

        // logger.info('handleAppRequest: req.body:', req.body);

        const thisContext = getRequestContext(req);
        const {
            reqObj,
            itsFor, action, searchQuery, accountId, userId,
            offset, limit
        } = thisContext;
        const isAuthRequest = ['signup', 'signin', 'signout'].includes(itsFor);
        let account = null;
        let user = null;
        let workspace = null;
        let session = null;

        // logger.info({
        //     itsFor, action, searchQuery, accountId, userId,
        //     offset, limit
        // })

        // validate required fields
        if (!itsFor) {
            resObj.message = 'Missing itsFor in request';
            resObj.status = 'error';
            return res.json(resObj);
        };
        if (!isAuthRequest) {
            const sessionRes = await getSessionFromRequest(req, res);
            // logger.info('handleAppRequest: sessionRes:', sessionRes);

            if (!sessionRes.success) {
                logger.warn('Session not found:', { accountId, userId });
                return clearAuthUnauthorized(res);
            }
            session = sessionRes?.data || null;
            account = session?.account || null;
            user = session?.user || null;
            workspace = session?.workspace || null;
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
            resObj = await handleSignin({ data: singleItem, res });
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

                const thisAccount = await Prisma.accounts.findFirst({
                    where: { id: account.id },
                    select: {
                        id: true,
                        name: true,
                        country: true,
                        currency: true,
                        createdAt: true,
                        updatedAt: true,
                        sessions: {
                            where: {
                                userId: user.id,
                            },
                            omit: {
                                sessionToken: true,
                            },
                        },
                    },
                });

                // get user.config.settings 
                resObj.success = true;
                resObj.message = 'Settings config retrieved successfully';
                resObj.data = thisAccount;
                resObj.status = 'success';
            } else if (action === 'update' || action === 'create') {
                // update user.config.settings
                const thisAccount = await Prisma.accounts.update({
                    where: { id: account.id },
                    data: {
                        name: data.name || account.name,
                        country: data.country || account.country,
                        currency: data.currency || account.currency,
                    },
                    include: {
                        sessions: true,
                    }
                });

                resObj.success = true;
                resObj.message = 'Settings config updated successfully';
                resObj.data = {
                    ...thisAccount,
                    ...data,
                };
                resObj.status = 'success';
            }

        } else if (itsFor === 'sessions') {

            if (action === 'get') {
                const sessions = await Prisma.sessions.findMany({
                    where: {
                        accountId: account.id,
                        userId: user.id,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    omit: {
                        sessionToken: true,
                    },
                });

                resObj.success = true;
                resObj.message = 'Sessions retrieved successfully';
                resObj.data = sessions;
                resObj.status = 'success';
            } else if (action === 'delete') {
                const idsToDelete = itemsIds.length > 0 ? itemsIds : [session.id];

                logger.info('Deleting sessions with ids:', idsToDelete);
                const deleted = await Prisma.sessions.deleteMany({
                    where: {
                        id: { in: idsToDelete },
                        accountId: account.id,
                        userId: user.id,
                    },
                });

                resObj.success = true;
                resObj.message = 'Sessions deleted successfully';
                resObj.data = deleted;
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

            const messages = reqObj.data?.messages || [];
            const searchType = reqObj.data?.type || 'vehicle'; //vehicle or part
            if (searchType === 'vehicle') {

                return aiStream(req, res, {
                    context: thisContext,
                    account, user, workspace,
                    messages: messages,
                    tools: {
                        inventoryPartsSearchTool: createInventoryPartsSearchTool({ accountId: account.id, workspaceId: workspace.id }),
                        vinSearchTool: createVinSearchTool({ vin: '' }),
                        web_search: anthropic.tools.webSearch_20260318({ maxUses: 3 }),
                    },
                    system: [
                        'You are a concise parts search assistant inside garage management software.',
                        '',
                        'The vehicle must be fully identified before anything else. Do not discuss, ask about, or search for any part until the vehicle is confirmed.',
                        '',
                        'STEP 1: Identify the vehicle (mandatory, always first).',
                        '- Read ALL previous messages first and extract anything already stated (including any VIN, make, model, yearFrom, yearTo, generation, trim, bodyType, doors, or fuelType). Never ask for something already given.',
                        '- VIN Priority: If a 17-character VIN is available in the conversation and make, model, or yearFrom is not populated, use available tools such as vinSearchTool or web_search to decode it and populate vehicle data before asking the user any questions.',
                        '- Record the tool name in vehicle.sources. Do not ask for the VIN if it is already present in the conversation. Do not call tools already listed in vehicle.sources.',
                        '- Required: make, model, yearFrom. Also required: trim or fuelType when the part could depend on it.',
                        '- If anything required is still missing (and no VIN was provided to decode it), ask ONE short question for the single most important missing field only. When the answer is a known set, return it as an options block.',
                        '- The vehicle counts as identified only when make, model, and yearFrom are all set in the app.vehicle block.',
                        '- Do not move to Step 2 until the vehicle is identified.',
                        '',
                        'STEP 2: Part.',
                        '- Only start this step after make, model, and yearFrom are set in app.vehicle.',
                        '- Identify which part the user needs. If the user already named it earlier, use it and do not ask again.',
                        '- If unclear, ask ONE question. If the part needs a variant (front/rear, left/right), ask the question.',
                        '- return genuine/orginal part numbers first then aftermarket part numbers if available clearly state which is which.',
                        '',
                        'STEP 3: Part numbers.',
                        '- ALWAYS call web_search first to find OEM part numbers for the exact vehicle and part. Never rely on memory alone. Unless already called and you already have part numbers, do not call web_search again unless the user asks to search again or changes the vehicle.',
                        '- Search for the yearFrom, make, model, trim, part, and variant, for example: "2016 Mercedes CLS550 W218 rear brake pads OEM part number".',
                        '- Only use numbers that appear in search results. If search finds nothing, say so in one line, ask for the 17-character VIN (if not already provided), and stop.',
                        '- If OEM numbers are found, proceed immediately to Step 4 in the same turn without asking for confirmation.',
                        '',
                        'STEP 4: Search.',
                        '- In the same turn, call inventoryPartsSearchTool with all verified candidate numbers in the partNumbers array.',
                        '- Never pass dummy values (like "00000000").',
                        '- Only report inventory results that come from an inventoryPartsSearchTool result in this turn. If the tool was not called, never state search outcomes.',
                        '- Once inventoryPartsSearchTool returns, write the candidate numbers in one short line ("Candidate OEM numbers: X, Y, Z") followed immediately by the inventory results.',
                        '',
                        'Rules:',
                        '- If the user changes the vehicle at any point, reset app.vehicle fields to the new vehicle and return to Step 1 before searching again.',
                        '- Maximum 2 clarifying questions in total. After that, state your best assumption in one short phrase and proceed.',
                        '- Never ask more than one question per message.',
                        '- Never chat, explain, or offer extras. Every message must either ask the next missing field, or run web_search, call inventoryPartsSearchTool, list the candidate part numbers, and present the inventory results.',
                        '- Dont use mention/expose any naming used for tools or internal functions in your responses to the user. Only use generalized descriptions that are relevant.',
                    ].join('\n'),
                });
            } else if (searchType === 'part') {

                return aiStream(req, res, {
                    context: thisContext,
                    account, user, workspace,
                    messages: messages,
                    tools: {
                        inventoryPartsSearchTool: createInventoryPartsSearchTool({ accountId: account.id, workspaceId: workspace.id }),
                        web_search: anthropic.tools.webSearch_20260318({ maxUses: 3 }),
                    },
                    system: [
                        'You are a concise parts cross-reference assistant inside garage management software.',
                        '',
                        'The user has submitted a part number. Your goal is to identify the part, cross-reference its OE/OEM numbers first, find aftermarket alternatives second, and check internal inventory for matches.',
                        '',
                        'STEP 1: Extract the part number.',
                        '- Read ALL previous messages and extract the submitted part number (clean up formatting/spaces only when needed for search, while keeping the original reference).',
                        '- If no part number is present or it is too incomplete/ambiguous to look up, ask ONE short question requesting the part number. Do not proceed until a part number is provided.',
                        '',
                        'STEP 2: Cross-reference via web_search.',
                        '- ALWAYS call web_search first to identify the part and cross-reference OEM and aftermarket equivalent part numbers. Never rely on memory alone.',
                        '- Do not call web_search again for the same part number unless the user provides a new part number or asks to search again.',
                        '- Search using queries like: "<part_number> cross reference OEM" or "<part_number> equivalent part numbers".',
                        '- Separate verified numbers strictly into two groups:',
                        '  1. Genuine / OE / OEM part numbers (list these FIRST, including superseded/interchange OE numbers if verified).',
                        '  2. Aftermarket cross-reference part numbers (include brand + part number, e.g., Bosch, Mann, Brembo, TRW, etc.).',
                        '- Only use part numbers that explicitly appear in search results. Never guess or fabricate cross-references.',
                        '- If web_search finds no valid cross-references, still run Step 3 with the user-submitted part number alone before reporting that no cross-references were found.',
                        '- Always send partNumber findings to the user and then move to the next step.',
                        '',
                        'STEP 3: Internal inventory search.',
                        '- Call inventoryPartsSearchTool passing the submitted part number plus ALL verified OE and aftermarket cross-reference numbers in the partNumbers array.',
                        '- Never pass dummy values (like "00000000").',
                        '- Only report inventory results that come from an inventoryPartsSearchTool result in this turn. If the tool was not called, never state search outcomes.',
                        '',
                        'Rules:',
                        '- If the user submits a new part number at any point, discard the previous part numbers and restart from Step 1.',
                        '- Never ask for vehicle details unless web_search returns conflicting parts for the exact same number and requires disambiguation (maximum 1 clarifying question).',
                        '- Never chat, explain, or offer extras. Every message must either ask for the missing/ambiguous part number, or run web_search, call inventoryPartsSearchTool, list the OE and aftermarket numbers, and present the inventory results.',
                        '- Do not mention or expose any internal tool names or function names in your responses to the user. Only use generalized descriptions when necessary.',
                    ].join('\n'),
                });


            }

        } else if (itsFor === 'ai-partNumber-search') {

            const messages = reqObj.data?.messages || [];

            let msgs = messages;
            const hasMedia = messages.some(
                (m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image' || p.type === 'file'),
            );

            if (hasMedia) {
                const { text } = await generateText({
                    model: anthropic('claude-haiku-5-5'),
                    messages,
                    system: 'Reply with only the part number printed on the part or box. No brand, dimensions, or material codes. If there are several parts, one part number per line.',
                });
                msgs = [{ role: 'user', content: text.trim() }];
            }

            const response = await generateText({
                // model: openai('gpt-6-luna'),
                model: google('gemini-3.8-flash'),
                // model: anthropic('claude-haiku-5-5'),
                messages: msgs,
                tools: {
                    // web_search: anthropic.tools.webSearch_20260318({ maxUses: 3 }),
                },
                system: [
                    'You are a vehicle parts search assistant inside parts store management software.',
                    'Your goal is to retrieve complete vehicle fitment, OEM/interchange part numbers, and clean catalog product descriptions.',
                    'The user message contains one or more part numbers, one per line. Return one entry per part number.',
                    '',
                    '### MULTI-QUERY CATALOG SEARCH (MANDATORY FOR EVERY PART NUMBER)',
                    'For EACH part number, you MUST find both vehicle fitment AND interchange/cross-reference numbers:',
                    '1. **Primary Search:** Search the exact part number (e.g., `"MKD930"`).',
                    '2. **Interchange Follow-Up Search (Required if Primary Search lacks cross-references or full vehicle years):** Run a second search specifically for cross-references and fitment (e.g., `"MKD930" interchange OR "cross reference" OR OEM`).',
                    '3. **FMSI / Base Number Pattern:** Remember that aftermarket brake/part numbers often share a base FMSI number across brands (e.g., `MKD930` corresponds to `D930`, `ACT930`, `NAD930`, `102.09300`). Always capture those equivalent numbers in `partNumbers`.',
                    '',
                    '### STRICT CATALOG OUTPUT RULES (APPLIES TO ALL FIELDS)',
                    '- **Catalog Tone Only:** Write every field as clean, final e-commerce/POS catalog data. NEVER write audit logs, search commentary, or disclaimers in ANY field (`name`, `description`, `otherNames`).',
                    '  - NEVER mention websites searched (e.g., do NOT write `"per a parts listing (gbayltd.online)"`).',
                    '  - NEVER mention missing data, unconfirmed details, or rejected search results (e.g., do NOT write `"Years and engine not confirmed"`, `"Box label dimensions not used"`, or `"other MKD-numbered results were not treated as cross-references"`).',
                    '- **`name`:** `[Make Model Year-Range] [Official Part Name]` (e.g., `"Lexus RX300 2002-2003 Front Disc Brake Pad Set"`). If years are unknown, use `[Make Model] [Part Name]` or just `[Part Name]`. Never put part numbers or notes in `name`.',
                    '- **`brand`:** Manufacturer/brand name (e.g., `"Friction Master"`). Leave `""` only if completely unknown.',
                    '- **`description`:** Clean 1-2 sentence product summary stating vehicle application, position (Front/Rear), material/specs, and key interchange references.',
                    '- **`partNumber`:** Exact searched part number.',
                    '- **`partNumbers`:** Array of all OEM and aftermarket interchange/cross-reference numbers (e.g., `["D930", "ACT930", "NAD930", "102.09300"]`).',
                    '- **`otherNames`:** Array of clean, generic catalog search terms (e.g., `["Front Disc Brake Pads", "Front Brake Pad Set", "Semi-Metallic Brake Pads"]`). Do NOT include part numbers or brand names inside `otherNames`.',
                ].join('\n'),
                tools: {
                    web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }),
                },
                stopWhen: stepCountIs(3),
                output: Output.array({
                    element: z.object({
                        name: z.string().describe('make, model, year, engine/trim of the vehicle, part name and variant if applicable, in one line'),
                        brand: z.string().describe('brand of the part if known, otherwise empty string'),
                        description: z.string().describe('description of the part if known, otherwise empty string'),
                        partNumber: z.string().describe('The main partNumber coming from input data , text or image , whatever user is sending.'),
                        barcode: z.string().describe('Barcode of the part if known either from input or image (the most likely source), otherwise empty string'),
                        quantity: z.number().describe('Quantity of the part if known, otherwise 0'),
                        partNumbers: z
                            .array(z.string())
                            .describe('Array of candidate part numbers found in search results. Return an empty array [] if none found.'),
                        otherNames: z
                            .array(z.string())
                            .describe('Array of other names or synonyms for the part if known, otherwise empty array []'),
                    }),
                }),
            });
            const out = response.output;

            // logger.info('ai-partNumbers response.out:', out);

            if (out.length === 0 || !out.every(item => item.name && item.partNumber)) {
                resObj.success = false;
                resObj.message = 'AI response is missing required fields';
                resObj.status = 'error';
                return res.json(resObj);
            }

            resObj.success = true;
            resObj.message = 'part number search completed successfully';
            resObj.data = out;
            resObj.status = 'success';

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
                            { partNumber: { contains: searchQuery, mode: 'insensitive' } },
                            { partNumbers: { has: searchQuery } },
                            { otherNames: { has: searchQuery } },
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


                const existingParts = await Prisma.parts.findMany({
                    where: {
                        workspaceId: workspace.id,
                        partNumber: { in: itemsWithIds.map(item => item.partNumber).filter(Boolean) },
                    },
                });


                const existingByPartNumber = new Map();
                for (const part of existingParts) {
                    if (part.partNumber && !existingByPartNumber.has(part.partNumber)) {
                        existingByPartNumber.set(part.partNumber, part);
                    }
                }

                const itemsToCreate = [];
                const incrementsById = new Map();
                for (const item of itemsWithIds) {
                    if (item.partNumber && existingByPartNumber.has(item.partNumber)) {
                        const existing = existingByPartNumber.get(item.partNumber);
                        const currentIncrement = Number(incrementsById.get(existing.id) ?? 0);
                        incrementsById.set(existing.id, currentIncrement + Number(item.quantity ?? 0));
                    } else {
                        itemsToCreate.push(item);
                    }
                }

                if (itemsToCreate.length > 0) {
                    const duplicateCheck = await Prisma.parts.findMany({
                        where: {
                            workspaceId: workspace.id,
                            OR: itemsToCreate.map(item => ({
                                sku: item.sku,
                            })),
                        },
                    });

                    if (duplicateCheck.length > 0) {
                        resObj.success = false;
                        resObj.message = 'One or more parts already exist with the same SKU';
                        resObj.data = duplicateCheck;
                        resObj.status = 'error';
                        return res.json(resObj);
                    }
                }

                const result = await Prisma.$transaction(async (tx) => {
                    const updatedParts = [];

                    for (const [id, incrementBy] of incrementsById.entries()) {
                        const updated = await tx.parts.update({
                            where: { id, workspaceId: workspace.id },
                            data: {
                                quantity: {
                                    increment: Number(incrementBy ?? 0),
                                },
                            },
                        });
                        updatedParts.push(updated);
                    }

                    const createdParts = await Promise.all(
                        itemsToCreate.map(item => tx.parts.create({ data: item }))
                    );

                    return [...updatedParts, ...createdParts];
                });

                resObj.success = true;
                resObj.message = 'Parts processed successfully';
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
        } else if (itsFor === 'files') {
            return await handleFileRequest({ req, res, context: { ...thisContext, workspace, user, account } });
        } else if (itsFor === 'conversations') {

            const ids = getIdsFromData(items);
            if (action === 'get') {
                const whereClause = {
                    userId: user.id,
                    ...(ids.length ? { id: { in: ids } } : {}),
                    ...(searchQuery ? {
                        OR: [
                            { title: { contains: searchQuery, mode: 'insensitive' } },
                        ],
                    } : {}),
                    ...(filters.length ? filtersToPrismaWhere(filters) : {}),
                };
                // logger.info("handleAppRequest: whereClause:", whereClause);

                const [result, totalCount] = await Promise.all([
                    Prisma.conversations.findMany({
                        where: whereClause,
                        include: {
                            messages: {
                                orderBy: [{ createdAt: 'desc' }],
                                // take: 1, // Get only the latest message
                            },
                        },
                        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                        take: limit,
                        skip: offset,
                    }),
                    Prisma.conversations.count({ where: whereClause }),
                ]);
                resObj.success = true;
                resObj.message = 'Conversations retrieved successfully';
                resObj.data = result;
                resObj.totalCount = totalCount;
                resObj.status = 'success';
            }


        } else if (itsFor === 'test2') {
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


;
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
