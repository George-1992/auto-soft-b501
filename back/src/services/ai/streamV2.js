
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

export const aiRequest = async ({
    system = '',
    messages = [],
    account,
    tools = {},
    onProgress = null,
    signal = null,
}) => {

    const msgs = [...messages];
    const addMessage = async (message) => {
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

        const finalMessage = aires.at(-1);
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