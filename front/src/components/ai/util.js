import { logger } from "@/src/services/logger";
import imageCompression from 'browser-image-compression';


export const streamToData = async (stream, onData, signal, onStatus) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleFrame = (frame) => {
        let event = null;
        const dataLines = [];

        for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }

        if (!dataLines.length) return;

        let payload;
        try {
            payload = JSON.parse(dataLines.join('\n'));
        } catch (error) {
            logger.error('Bad stream frame:', frame, error);
            return;
        }

        if (event === 'delta') {
            const incoming = Array.isArray(payload) ? payload : [payload];
            onData(incoming.filter(Boolean));
        } else if (event === 'status') {
            onStatus?.(payload);
        } else if (event === 'error') {
            throw new Error(payload?.message || 'Stream error');
        } else if (event === 'done') {
            return 'done';
        }
    };

    try {
        signal?.addEventListener('abort', () => reader.cancel(), { once: true });

        while (true) {
            const { value, done } = await reader.read();

            if (value) {
                buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
            }

            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
                const frame = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                boundary = buffer.indexOf('\n\n');

                if (handleFrame(frame) === 'done') {
                    await reader.cancel();
                    return true;
                }
            }

            if (done) {
                if (buffer.trim()) handleFrame(buffer);
                break;
            }
        }

        return true;
    } catch (error) {
        if (signal?.aborted) return false;
        logger.error('Error processing stream:', error);
        throw error;
    } finally {
        reader.releaseLock?.();
    }
};

export const normalizeMessageToParts = (message = {}) => {
    const normalizedParts = [];

    const normalizePart = (item = {}, index = 0) => {
        if (!item || typeof item !== 'object') return null;

        if (item.type === 'text' && typeof item.text === 'string') {
            return {
                type: 'text',
                text: item.text,
            };
        }

        if (item.type === 'custom' && item.kind === 'app.options') {
            const optionsData = item?.providerOptions?.data;
            const options = Array.isArray(optionsData?.options)
                ? optionsData.options
                    .map((option, optionIndex) => ({
                        id: option?.id || String(optionIndex + 1),
                        label: option?.label || option?.value || '',
                        value: option?.value || option?.label || '',
                    }))
                    .filter((option) => option.label && option.value)
                : [];

            if (!options.length) {
                return null;
            }

            return {
                type: 'options',
                prompt: optionsData?.prompt,
                options,
            };
        }

        if (item.type === 'custom' && item.kind === 'app.vehicle') {
            return {
                type: 'vehicle',
                data: item?.providerOptions?.data || null,
            };
        }

        if (item.type === 'file') {
            const mediaType = item.mediaType || 'application/octet-stream';
            const fileData = typeof item.data === 'string' ? item.data : '';
            const src = item.url
                || (fileData
                    ? (fileData.startsWith('data:') ? fileData : `data:${mediaType};base64,${fileData}`)
                    : '');
            return {
                type: 'file',
                url: src,
                data: item.data,
                mediaType,
                filename: item.filename || `attachment-${index + 1}`,
            };
        }

        if (item.type === 'options' && Array.isArray(item.options) && item.options.length > 0) {
            return {
                type: 'options',
                prompt: item.prompt,
                options: item.options
                    .map((option, optionIndex) => ({
                        id: option?.id || String(optionIndex + 1),
                        label: option?.label || option?.value || '',
                        value: option?.value || option?.label || '',
                    }))
                    .filter((option) => option.label && option.value),
            };
        }

        if (item.type === 'card') {
            return {
                type: 'card',
                title: item.title || 'Card',
                subtitle: item.subtitle || undefined,
                imageUrl: item.imageUrl || item.image || undefined,
                fields: Array.isArray(item.fields)
                    ? item.fields
                        .map((field) => ({ label: field?.label || '', value: field?.value || '' }))
                        .filter((field) => field.label && field.value)
                    : undefined,
                actionUrl: item.actionUrl || undefined,
            };
        }

        if (item.type === 'partNumber') {
            return item; // Return the partNumber element as-is
        }

        return null;
    };

    if (Array.isArray(message.content)) {
        return message.content
            .map((item, index) => normalizePart(item, index))
            .filter(Boolean);
    }

    if (typeof message.content === 'string' && message.content.trim()) {
        normalizedParts.push({
            type: 'text',
            text: message.content,
        });
    }

    if (Array.isArray(message.render)) {
        for (const renderItem of message.render) {
            if (!renderItem || typeof renderItem !== 'object') continue;

            if (renderItem.type === 'options' && Array.isArray(renderItem.options) && renderItem.options.length > 0) {
                normalizedParts.push({
                    type: 'options',
                    prompt: renderItem.prompt || renderItem.title || undefined,
                    options: renderItem.options.map((option, index) => ({
                        id: option?.id || String(index + 1),
                        label: option?.label || option?.value || '',
                        value: option?.value || option?.label || '',
                    })).filter((option) => option.label && option.value),
                });
            }

            if (renderItem.type === 'card') {
                normalizedParts.push({
                    type: 'card',
                    title: renderItem.title || 'Card',
                    subtitle: renderItem.subtitle || undefined,
                    imageUrl: renderItem.image || renderItem.imageUrl || undefined,
                    fields: Array.isArray(renderItem.fields)
                        ? renderItem.fields
                            .map((field) => ({ label: field?.label || '', value: field?.value || '' }))
                            .filter((field) => field.label && field.value)
                        : undefined,
                    actionUrl: renderItem.actionUrl || undefined,
                });
            }
        }
    }

    return normalizedParts;
};

export const compressFiles = async (files) => {
    const options = {
        maxSizeMB: 1,              // Target max file size (1MB is standard for web/chat)
        maxWidthOrHeight: 1920,    // Cap longest edge (1920px or 2048px is standard)
        useWebWorker: true,        // Runs off main thread so UI doesn't freeze
        fileType: 'image/webp',    // Modern format: ~30% smaller than JPEG with transparency support
        initialQuality: 0.8,       // Sweet spot between visual fidelity and size
    };

    const compressibleTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const minCompressBytes = 64 * 1024;

    return Promise.all(
        files.map(async (file) => {
            // Skip GIFs, SVGs, PDFs, etc.
            if (!compressibleTypes.includes(file.type)) {
                logger.info('UploadButton compression skipped (unsupported type):', {
                    name: file.name,
                    type: file.type,
                });
                return file;
            }

            // Skip tiny files where recompression gains are usually negligible.
            if (file.size <= minCompressBytes) {
                logger.info('UploadButton compression skipped (small file):', {
                    name: file.name,
                    sizeKB: (file.size / 1024).toFixed(1),
                });
                return file;
            }

            try {
                const compressedBlob = await imageCompression(file, options);

                // Safety check: only use compressed version if it's actually smaller
                if (compressedBlob.size >= file.size) {
                    logger.info('UploadButton compression kept original (no gain):', {
                        name: file.name,
                        beforeKB: (file.size / 1024).toFixed(1),
                        afterKB: (compressedBlob.size / 1024).toFixed(1),
                    });
                    return file;
                }

                // Update extension to .webp if converted
                const newName = file.name.replace(/\.[^/.]+$/, '.webp');
                const outFile = new File([compressedBlob], newName, {
                    type: compressedBlob.type,
                    lastModified: Date.now(),
                });

                logger.info('UploadButton compression success:', {
                    name: file.name,
                    output: outFile.name,
                    beforeKB: (file.size / 1024).toFixed(1),
                    afterKB: (outFile.size / 1024).toFixed(1),
                    savedPercent: (((file.size - outFile.size) / file.size) * 100).toFixed(1),
                });

                return outFile;
            } catch (error) {
                logger.error('Compression failed, falling back to original:', error);
                return file;
            }
        })
    );
};

export const getConversationId = (messages = []) => {
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
