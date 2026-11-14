
import {
    generateText,
    streamText, tool, stepCountIs,
    Output,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { logger } from '#src/utils/logger.js';
import Prisma from '#src/db/prisma/index.js';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';

const aiModelName = 'gpt-5.4-nano';

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


const optionSchema = z.object({
    id: z.string(),
    value: z.string(),
    image: z.string().nullable(),
});

const blockSchema = z.object({
    type: z.enum(['text', 'options', 'card']).describe('options = clickable choices the user picks from'),
    title: z.string().nullable().describe('Short question or heading. Used by options and card.'),
    content: z.string().nullable().describe('Body text. Used by text and card. Null for options.'),
    image: z.string().nullable().describe('Image URL, only if known. Otherwise null.'),
    options: z.array(optionSchema).nullable().describe('Only for type options. Null for other types.'),
});

const responseSchema = z.object({
    content: z.string().describe('The assistant reply as plain text. Always present.'),
    render: z
        .array(blockSchema)
        .describe(
            'UI blocks shown under the reply. Return an empty array [] by default. ' +
            'Only add an "options" block when the user must pick from a fixed, known set of answers. ' +
            'Never add blocks for open ended answers.'
        ),
    vehicle: z.object({
        image: z.string().nullable().describe('Image URL of the vehicle from the search query, if known.'),
        make: z.string().nullable(),
        model: z.string().nullable(),
        yearFrom: z.number().nullable(),
        yearTo: z.number().nullable(),
        generation: z.string().nullable(),
        trim: z.string().nullable(),
        bodyType: z.string().nullable(),
        doors: z.number().nullable(),
        fuelType: z.string().nullable(),
    }).nullable().describe(
        'Vehicle identified so far. Fill on every response with everything known, null for unknown fields. ' +
        'make, model and yearFrom must all be set before any part search.'
    ),
})

export const aiRequest = async ({ system = '', messages = [], account, tools = {} }) => {
    const msgs = [...messages];
    const addMessage = async (message) => {
        msgs.push(message);
    };
    try {

        // if messages is empty, add default assistant message response
        if (msgs.length === 0) {
            // logger.info('No messages provided, adding default assistant message.');
            addMessage({
                role: 'assistant',
                content: 'Hello! How can I assist you today?',
                render: [],
                vehicle: null,
            });
            return msgs;
        }


        const response = await generateText({
            // model: openai('gpt-6-luna'),
            // model: google('gemini-3.8-flash'),
            model: anthropic('claude-haiku-5-5'),
            messages: msgs.map(({ role, content }) => ({ role, content })),
            system,
            tools: {
                ...tools,
                web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }),
            },
            stopWhen: stepCountIs(2),
            output: Output.object({ schema: responseSchema }),
        });

        const out = response.output;
        const usage = response?.totalUsage ||response.usage || {};
        logger.info('AI Request usage:', usage);
        
        // logger.info('AI Request Response:', out);
        // addMessage({
        //     role: 'assistant',
        //     content: out.content,
        //     render: out.render,
        //     vehicle: out.vehicle ?? null,
        // });

        addMessage({ ...out, role: 'assistant' });

    } catch (error) {
        const formatted = normalizeAiError(error);
        logger.error('Error in aiRequest:', {
            code: formatted.code,
            message: formatted.message,
            details: formatted.details,
        });

        addMessage({
            role: 'assistant',
            content: `Error: ${formatted.code}: ${formatted.message}`,
        });
    }

    return msgs;
};

export const aiStream = async (req, res,
    {
        system = '', messages = [], account = null, tools = {},
        user = null, workspace = null
    } = {}
) => {

    try {
        // console.log('>>> req.body ... ', req.body);
        // console.log('>>> handleAiSearchRequest ... ', messages);

        const dataFromBody = () => {
            const searchQuery = req.body?.data?.query || '';
            return searchQuery;
        };

        const theAiStream = async function* ({ signal }) {
            const searchQuery = dataFromBody();
            // logger.info('AI Search Query:', searchQuery);

            const aires = await aiRequest({
                account: account,
                system: system,
                messages: messages,
                tools: tools,
            });

            const finalMessage = aires.at(-1);
            if (!finalMessage) {
                return;
            }

            if (signal.aborted) {
                return;
            }

            yield finalMessage;
        };


        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // disables nginx buffering
        res.flushHeaders();

        const controller = new AbortController();
        req.on('close', () => controller.abort());

        const send = (event, data) => {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        for await (const chunk of theAiStream({ signal: controller.signal })) {
            // logger.info('Streaming chunk:', chunk);
            send('delta', chunk);
        }

        send('done', {});
        res.end();
    } catch (error) {
        logger.error('Error in handleAiSearchRequest:', error?.message || error);
        if (res.headersSent) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: error.message });
        }
    }
};