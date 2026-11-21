import {
    generateText,
    streamText, tool, stepCountIs,
    Output,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { logger } from '#src/utils/logger.js';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { responseSchema } from '#src/services/ai/responseTypes.js';
import { normalizeAiError } from '#src/services/ai/logs.js';
import fs from 'fs';
import path from 'path';
import { processClientMessages } from '#src/services/ai/util.js';
import Prisma from '#src/db/prisma/index.js';



const toPublicToolLabel = (toolName = '') => {
    const key = String(toolName || '').toLowerCase();

    if (key.includes('web_search') || key.includes('websearch')) {
        return 'search';
    }
    if (key.includes('vinsearch') || key.includes('vin_search')) {
        return 'VIN lookup';
    }
    if (key.includes('partssearch') || key.includes('parts_search')) {
        return 'inventory lookup';
    }

    return 'data lookup';
};
export const toModelMessage = ({ messages = [], system = '' }) => {
    const arr = [];

    try {
        let vehicle = {};

        for (const message of messages) {
            // 1. Merge vehicle state globally for the system prompt
            if (message?.vehicle && typeof message.vehicle === 'object') {
                vehicle = { ...vehicle, ...message.vehicle };
            }

            // 2. Clone content safely without mutating the original message
            let normalizedContent = [];
            if (Array.isArray(message?.content)) {
                normalizedContent = message.content.map((part) => {
                    if (part.type === 'options') {
                        return { type: 'text', text: part?.prompt || '' };
                    }
                    if (part.type === 'partNumber') {
                        return {
                            type: 'text',
                            text: [
                                `Source: ${part?.source || 'N/A'}`,
                                `Manufacturer: ${part?.manufacturer || 'N/A'}`,
                                `Label: ${part?.label || 'N/A'}`,
                                `Value: ${part?.value || 'N/A'}`,
                                `Description: ${part?.description || 'N/A'}`,
                            ].join('\n'),
                        };
                    }
                    return { ...part };
                });
            } else if (typeof message?.content === 'string') {
                normalizedContent = [{ type: 'text', text: message.content }];
            }

            // 3. Keep searched parts tied to the exact turn they occurred in
            if (Array.isArray(message?.parts) && message.parts.length > 0) {
                normalizedContent.push({
                    type: 'text',
                    text: `Searched Parts Context:\n${JSON.stringify(message.parts, null, 2)}`,
                });
            }

            // Build clean message without custom properties (vehicle, parts)
            const { vehicle: _v, parts: _p, ...cleanMessage } = message;
            arr.push({
                ...cleanMessage,
                content: normalizedContent,
            });
        }

        const systemExtras = Object.keys(vehicle).length > 0
            ? `\n\nActive Vehicle Info:\n${JSON.stringify(vehicle, null, 2)}`
            : '';

        return {
            system: `${system || ''}${systemExtras}`,
            messages: arr,
            vehicle,
        };
    } catch (error) {
        logger.error('Error in toModelMessage:', error?.message || error);
        return { system, messages: arr, vehicle: {} };
    }
};

const getConversationId = (messages = []) => {
    try {
        let id = null;
        for (const message of messages) {
            if (message?.conversationId) {
                id = message.conversationId;
            }
        }

        return id;
    } catch (error) {
        logger.error('Error in getConversationId:', error?.message || error);
        return null;
    }
};

const getTrailingUserMessages = (messages = []) => {
    const trailing = [];

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role !== 'user') break;
        trailing.unshift(message);
    }

    return trailing;
};

const getTextContent = (content = []) => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    const text = content.map((part) => {
        if (part?.type === 'text') return part.text || '';
        if (part?.type === 'options') return part.prompt || '';
        if (part?.type === 'partNumber') {
            return [part.label, part.value, part.description].filter(Boolean).join(' ');
        }
        return '';
    }).filter(Boolean).join('\n');

    return text || JSON.stringify(content);
};

export const aiRequest = async ({
    system = '',
    messages = [],
    account,
    tools = {},
    onProgress = null,
    signal = null,
}) => {
    // logger.info('aiRequest messages:', messages);

    const msgs = await processClientMessages({ messages });
    const addMessage = async (message) => {
        // logger.info('Adding message to msgs:', message);
        msgs.push(message);
    };
    const safeUrl = (str) => {
        try {
            return new URL(str);
        } catch {
            return null;
        }
    };
    const reportProgress = (payload = {}) => {
        try {
            if (typeof onProgress === 'function') {
                onProgress({
                    phase: payload.phase || 'processing',
                    message: payload.message || 'Processing request...',
                    meta: payload.meta || {},
                    at: new Date().toISOString(),
                });
            }
        } catch (error) {
            logger.warn('Progress callback failed:', error?.message || error);
        }
    };
    const getToolNames = (arr = []) => {
        try {
            const names = arr
                .map((item) => item?.toolName || item?.name || item?.type)
                .filter(Boolean);

            return [...new Set(names)];
        } catch (error) {
            logger.error('Error in getToolNames:', error?.message || error);
            return [];
        }
    };
    const toPublicToolLabels = (toolNames = []) => {
        const labels = toolNames.map(toPublicToolLabel).filter(Boolean);
        return [...new Set(labels)];
    };

    try {

        // if messages is empty, add default assistant message response
        if (msgs.length === 0) {
            // logger.info('No messages provided, adding default assistant message.');
            addMessage({
                role: 'assistant',
                parts: [{ type: 'text', text: 'Hello! How can I assist you today?' }],
            });
            return msgs;
        }

        reportProgress({
            phase: 'preparing',
            message: 'Preparing your request...',
        });

        const { system: modelSystem, messages: modelMessages } = toModelMessage({ messages: msgs, system });
        // const filePath = path.join(__dirname, 'modelMessages.json');
        const logDir = path.join(process.cwd(), 'logs');
        // const filePath = path.join(logDir, 'modelMessages.json');
        // // Ensure directory exists once at startup, or use recursive mkdir
        // fs.promises.mkdir(logDir, { recursive: true })
        //     .then(() => fs.promises.writeFile(filePath, JSON.stringify(modelMessages, null, 2)))
        //     .catch(console.error);

        const response = await generateText({
            // model: openai('gpt-6-luna'),
            // model: google('gemini-3.8-flash'),
            model: anthropic('claude-haiku-5-5'),
            messages: modelMessages,
            system: modelSystem,
            tools: {
                ...tools,
                // web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }),
            },
            stopWhen: stepCountIs(5),
            abortSignal: signal || undefined,
            // onStepFinish: (props) => {
            //     // logger.info('Step finished props:', props);
            //     const randomSuffix = Math.random().toString(36).substring(2, 8);
            //     fs.promises.writeFile(path.join(logDir, `onStepFinishprops_${randomSuffix}.json`), JSON.stringify(props, null, 2)).catch(console.error);
            // },
            onStepFinish: ({ toolCalls = [], toolResults = [] } = {}) => {
                const callNames = getToolNames(toolCalls);
                if (callNames.length > 0) {
                    const publicLabels = toPublicToolLabels(callNames);
                    const toolLabel = publicLabels.length === 1
                        ? `Using: ${publicLabels[0]}`
                        : `Using: ${publicLabels.join(', ')}`;

                    reportProgress({
                        phase: 'tooling',
                        message: toolLabel,
                        meta: {
                            tools: publicLabels,
                            toolCount: callNames.length,
                        },
                    });
                    return;
                }

                const resultNames = getToolNames(toolResults);
                if (resultNames.length > 0 || (Array.isArray(toolResults) && toolResults.length > 0)) {
                    const publicLabels = toPublicToolLabels(resultNames);
                    const toolLabel = publicLabels.length === 0
                        ? 'Processing retrieved data...'
                        : publicLabels.length === 1
                            ? `Processing results from: ${publicLabels[0]}`
                            : `Processing results from: ${publicLabels.join(', ')}`;

                    reportProgress({
                        phase: 'processing',
                        message: toolLabel,
                        meta: {
                            tools: publicLabels,
                            resultCount: Array.isArray(toolResults) ? toolResults.length : 0,
                        },
                    });
                    return;
                }

                reportProgress({
                    phase: 'reasoning',
                    message: 'Analyzing details...',
                });
            },
            output: Output.object({ schema: responseSchema }),
        });

        const out = response.output;
        const usage = response?.totalUsage || response.usage || {};
        // logger.info('AI Request usage:', usage);

        reportProgress({
            phase: 'finalizing',
            message: 'Finalizing response...',
            meta: { usage },
        });

        addMessage({ ...out, role: 'assistant' });

    } catch (error) {
        const formatted = normalizeAiError(error);
        logger.error('Error in aiRequest:', formatted);

        reportProgress({
            phase: 'error',
            message: formatted?.message || 'Request failed.',
            meta: { code: formatted?.code || 'unknown_error' },
        });

        addMessage({
            role: 'assistant',
            content: [{ type: 'text', text: `Error: ${formatted.code}: ${formatted.message}` }],
        });
    }

    return msgs;
};

export const aiStream = async (req, res,
    {
        context = {},
        system = '', messages = [], account = null, tools = {},
        user = null, workspace = null
    } = {}
) => {

    try {
        const { searchParams } = context;

        // console.log('>>> req.body ... ', req.body);
        // console.log('>>> handleAiSearchRequest ... ', messages);
        // logger.info('handleAiSearchRequest context:', context);
        // logger.info('handleAiSearchRequest searchParams:', searchParams);

        const dataFromBody = () => {
            const searchQuery = req.body?.data?.query || '';
            return searchQuery;
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

        send('status', {
            phase: 'started',
            message: 'Starting request...',
            at: new Date().toISOString(),
        });

        const searchQuery = dataFromBody();
        // logger.info('AI Search Query:', searchQuery);

        const aires = await aiRequest({
            account: account,
            system: system,
            messages: messages,
            tools: tools,
            signal: controller.signal,
            onProgress: (payload) => {
                // logger.info('AI Progress:', payload);
                if (!controller.signal.aborted) {
                    send('status', payload);
                }
            },
        });

        if (!user?.id) {
            throw new Error('Authenticated user is required for AI chat');
        }

        const requestedConversationId = getConversationId(messages);
        let conversationId = null;
        let conversationVehicle = {};

        if (requestedConversationId) {
            const existingConversation = await Prisma.conversations.findFirst({
                where: {
                    id: requestedConversationId,
                    userId: user.id,
                },
                select: { id: true, vehicle: true },
            });

            if (existingConversation) {
                conversationId = existingConversation.id;
                conversationVehicle = existingConversation.vehicle || {};
            } else {
                logger.warn('Ignoring stale conversationId:', requestedConversationId);
            }
        }

        if (!conversationId) {
            const finalMessage = aires.at(-1);
            conversationVehicle = finalMessage?.vehicle ||
                aires.find((message) => message?.vehicle)?.vehicle ||
                {};

            const conversation = await Prisma.conversations.create({
                data: {
                    title: searchQuery || 'New Conversation',
                    userId: user.id,
                    vehicle: conversationVehicle,
                },
            });

            conversationId = conversation.id;
        }

        for (const message of aires) {
            message.conversationId = conversationId;
        }

        const finalMessage = aires.at(-1);
        const trailingUserMessages = getTrailingUserMessages(messages);

        await Prisma.$transaction(async (tx) => {
            if (trailingUserMessages.length > 0) {
                await tx.messages.createMany({
                    data: trailingUserMessages.map((message) => {
                        const content = message.content || [];
                        return {
                            conversationId,
                            role: message.role || 'user',
                            content,
                            textContent: getTextContent(content),
                            parts: message.parts || [],
                        };
                    }),
                });
            }

            if (finalMessage) {
                const finalContent = finalMessage.content || [];
                await tx.messages.create({
                    data: {
                        conversationId,
                        role: finalMessage.role || 'assistant',
                        content: finalContent,
                        textContent: getTextContent(finalContent),
                        parts: finalMessage.parts || [],
                    },
                });
            }

            await tx.conversations.update({
                where: { id: conversationId },
                data: {
                    vehicle: finalMessage?.vehicle || conversationVehicle,
                },
            });
        });

        logger.info('AI Request: conversationId:', conversationId);

        if (!controller.signal.aborted && finalMessage) {
            send('delta', finalMessage);
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