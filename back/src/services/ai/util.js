import { getFileFromS3 } from "#src/services/s3/rustfs.js";
import { logger } from "#src/utils/logger.js";

// Helper: Extract the S3 key whether `part.key` is passed directly or embedded in `part.data` URL
const extractS3Key = (part) => {
    if (part.key) return part.key;
    if (typeof part.data === 'string' && part.data.includes('/file/')) {
        const rawKey = part.data.split('/file/').pop()?.split('?')[0] || '';
        return decodeURIComponent(rawKey);
    }
    return null;
};

export const processClientMessages = async ({ messages = [] }) => {
    try {
        const msgs = [];

        for (const message of messages) {
            const hasFile =
                Array.isArray(message.content) &&
                message.content.some((part) => part.type === 'file');

            if (!hasFile) {
                msgs.push(message);
                continue;
            }

            const newContent = await Promise.all(
                message.content.map(async (part) => {
                    if (part.type !== 'file') return part;

                    // Skip if it's already converted to a data URL
                    if (typeof part.data === 'string' && part.data.startsWith('data:')) {
                        return part;
                    }

                    const s3Key = extractS3Key(part);
                    if (!s3Key) {
                        throw new Error(`Missing S3 key for file part: ${JSON.stringify(part)}`);
                    }

                    // Remember: getFileFromS3 returns the stream directly (response.Body)
                    const fileStream = await getFileFromS3({
                        key: s3Key,
                    });

                    const buffer = await streamToBuffer(fileStream);
                    const base64Data = buffer.toString('base64');
                    const mimeType = part.mediaType || part.contentType || 'application/octet-stream';

                    return {
                        ...part,
                        data: `data:${mimeType};base64,${base64Data}`,
                    };
                })
            );

            msgs.push({ ...message, content: newContent });
        }

        return msgs;
    } catch (error) {
        logger.error('Error processing client messages:', error);
        throw error; // Re-throw instead of returning [] and silently wiping chat history
    }
};

export const streamToBuffer = async (input) => {
    if (!input) {
        throw new Error('streamToBuffer: input is null or undefined');
    }

    // 1. Unwrap if getFileFromS3 returned { stream, ... } or { Body, ... }
    const stream = input.stream || input.Body || input;

    // 2. Already a Buffer / Uint8Array / ArrayBuffer
    if (Buffer.isBuffer(stream)) return stream;
    if (stream instanceof Uint8Array) return Buffer.from(stream);
    if (stream instanceof ArrayBuffer) return Buffer.from(new Uint8Array(stream));

    // 3. AWS SDK v3 SdkStream helper
    if (typeof stream.transformToByteArray === 'function') {
        const bytes = await stream.transformToByteArray();
        return Buffer.from(bytes);
    }

    // 4. Web ReadableStream (Node 18+ fetch / undici — uses .getReader(), NOT .on())
    if (typeof stream.getReader === 'function') {
        const reader = stream.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(Buffer.from(value));
        }
        return Buffer.concat(chunks);
    }

    // 5. Async iterable / Node.js Readable stream
    if (typeof stream[Symbol.asyncIterator] === 'function') {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    throw new TypeError(
        `streamToBuffer: Unsupported stream type (${typeof stream}, keys: ${Object.keys(stream || {})})`
    );
};

const getConversationId = (messages = []) => {
    try {
        let id = null;
        for (const message of messages) {
            if (message?.conversationId) {
                id = message.conversationId;
                break;
            }
        }

        return id;
    } catch (error) {
        logger.error('Error in getConversationId:', error?.message || error);
        return null;
    }
};
