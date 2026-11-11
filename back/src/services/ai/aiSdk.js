import {
    convertToModelMessages, generateText,
    streamText, tool, stepCountIs,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { logger } from '#src/utils/logger.js';
import Prisma from '#src/db/prisma/index.js';

const aiModelName = 'gpt-5.4-nano'; // Valid OpenAI model
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const normalizeAiError = (error) => {
    const err = error || {};
    const message = err?.message || 'Unknown AI error';
    const name = err?.name || 'AIError';
    const isMissingApiKey =
        name === 'AI_LoadAPIKeyError' ||
        message.toLowerCase().includes('api key is missing');

    if (isMissingApiKey) {
        return {
            statusCode: 500,
            code: 'OPENAI_API_KEY_MISSING',
            message: 'AI service is not configured. Missing OPENAI_API_KEY on backend.',
            details: message,
        };
    }

    return {
        statusCode: 500,
        code: name,
        message: 'AI request failed. Please try again.',
        details: message,
    };
};
// Define the tool with Zod schema directly
const logToConsoleTool = tool({
    description: 'Log a message to the console',
    inputSchema: z.object({
        message: z
            .string()
            .describe('The message to log to the console'),
    }),
    execute: async ({ message }) => {
        logger.info('=======  TOOL ====== Console log from AI:', message);
    },
});


const createDbRequestTool = (accountId) => tool({
    description: 'Query database tables using Prisma-style query options. Account scope is applied automatically.',
    inputSchema: z.object({
        table: z
            .enum(['notes'])
            .default('notes')
            .describe('Target Prisma model to run findMany against'),
        where: z
            .object({
                id: z.string().optional(),
                title: z.string().optional(),
                content: z.string().optional(),
                accountId: z.string().optional(),
                workspaceId: z.string().optional(),
            })
            .default({})
            .describe('Optional notes filters. accountId is injected server-side.'),
        limit: z
            .coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20)
            .describe('Maximum number of records to return'),
        offset: z
            .coerce.number()
            .int()
            .min(0)
            .default(0)
            .describe('Number of records to skip'),
        orderBy: z
            .object({
                field: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
                direction: z.enum(['asc', 'desc']).default('desc'),
            })
            .optional()
            .describe('Sort configuration for notes'),
    }),
    execute: async ({ table, where, limit, offset, orderBy }) => {
        try {
            logger.info('=======  TOOL START: dbRequestTool ======');

            if (!accountId) {
                logger.error('DB Request Tool: missing accountId in server context');
                return [];
            }

            const whereClause = {
                ...(where || {}),
                accountId,
            };

            if (table !== 'notes') {
                logger.error('DB Request Tool: unsupported table requested:', table);
                return [];
            }

            const result = await Prisma.notes.findMany({
                where: whereClause,
                ...(typeof limit === 'number' ? { take: limit } : {}),
                ...(typeof offset === 'number' ? { skip: offset } : {}),
                ...(orderBy?.field && orderBy?.direction
                    ? { orderBy: { [orderBy.field]: orderBy.direction } }
                    : {}),
            });

            return result;

        } catch (error) {
            logger.error('DB Request Tool Error:', error?.message || error);
            return error?.message || 'error getting data';
        }
    },
});


export default async function HandleAiChatRequest(req, res, account, user, workspace) {
    try {

        if (!account || !user || !workspace) {
            return res.status(400).json({ error: 'Missing account, user, or workspace information' });
        }

        if (!OPENAI_API_KEY) {
            const formatted = normalizeAiError(new Error('OpenAI API key is missing. Set OPENAI_API_KEY in backend env.'));
            logger.error('AI Config Error:', {
                code: formatted.code,
                message: formatted.message,
                details: formatted.details,
            });
            return res.status(formatted.statusCode).json({
                success: false,
                status: 'error',
                code: formatted.code,
                message: formatted.message,
                details: formatted.details,
            });
        }

        const { messages } = req.body;
        // logger.info('HandleAiRequest: messages:', messages);
        const dbRequestTool = createDbRequestTool(account.id);

        const result = streamText({
            model: openai(aiModelName),
            system:
                `if user ask or you feel you need to get data on leads use the dbRequestTool to query the leads database.`
                + `if tools return no data, null or empty array use it to form your response.`
                + `if valid data is returned from the tool, use it to form your response.`
                + `if asked about pipline it means lead stages: lead, pendingApp, screening, preQualified, preApproval, active, pastClients, other.`
            ,
            messages: await convertToModelMessages(messages),
            tools: {
                logToConsole: logToConsoleTool,
                dbRequestTool: dbRequestTool,
            },
            // maxSteps: 6,
            stopWhen: stepCountIs(10),//to allow multiple tool calls then response
        });

        // logger.info('result steps:', await result);

        return result.pipeUIMessageStreamToResponse(res, {
            onError: (error) => {
                const formatted = normalizeAiError(error);
                logger.error('AI Stream Error:', {
                    code: formatted.code,
                    message: formatted.message,
                    details: formatted.details,
                });

                // This string is sent as stream error text and can be surfaced by the chat client.
                return `${formatted.code}: ${formatted.message}`;
            },
        });

    } catch (error) {
        const formatted = normalizeAiError(error);
        logger.error('Error handling AI request:', {
            code: formatted.code,
            message: formatted.message,
            details: formatted.details,
        });
        return res.status(formatted.statusCode).json({
            success: false,
            status: 'error',
            code: formatted.code,
            message: formatted.message,
            details: formatted.details,
        });
    }
};
