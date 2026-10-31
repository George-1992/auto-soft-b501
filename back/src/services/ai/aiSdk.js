import {
    convertToModelMessages, generateText,
    streamText, tool, stepCountIs,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { logger } from '#src/utils/logger.js';
import Prisma from '#src/db/prisma/index.js';

const aiModelName = 'gpt-5.4-nano'; // Valid OpenAI model
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


export default async function HandleAiRequest(req, res, account, user, workspace) {
    try {

        if (!account || !user || !workspace) {
            return res.status(400).json({ error: 'Missing account, user, or workspace information' });
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

        // logger.info('result steps:', await result?.steps);

        return result.pipeUIMessageStreamToResponse(res);

    } catch (error) {
        logger.error('Error handling AI request:', error?.message || error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}