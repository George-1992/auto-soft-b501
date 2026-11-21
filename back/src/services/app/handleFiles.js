import { getFileFromS3, listS3Buckets, uploadFileToS3 } from "#src/services/s3/rustfs.js";
import { logger } from "#src/utils/logger.js";
import { nanoid } from "nanoid";
import { Readable } from 'stream';

export const handleFileRequest = async ({ req, res, context }) => {
    let resObj = {
        success: false,
        message: 'File request handling not implemented yet',
        data: null,
    };

    try {
        // logger.info('>>>>>>>>>>handleFileRequest received');

        const { itsFor, action, searchParams, pathArray } = context;
        const files = req.files || [];

        // logger.info('handleFileRequest:', { itsFor, action, searchParams, pathArray, filesCount: files.length });

        // for (const file of files) {
        //     const mediaInfo = getFileMediaInfo(file);
        //     // logger.info({ mediaInfo })
        //     const response = await uploadFileToS3({
        //         bucketName: 'default',
        //         key: file.originalname,
        //         fileContent: file.buffer,
        //         contentType: mediaInfo.contentType,
        //     });
        //     logger.info({ response });
        // }

        if (action === 'get') {
            //to do for later
        } else if (action === 'create') {
            const result = []
            for (const file of files) {
                const s3Key = nanoid(20) + '-' + file.originalname;
                const mediaInfo = getFileMediaInfo(file);
                // logger.info({ mediaInfo })
                const response = await uploadFileToS3({
                    bucketName: 'default',
                    key: s3Key,
                    fileContent: file.buffer,
                    contentType: mediaInfo.contentType,
                });
                // logger.info({ response });
                result.push({
                    name: file.originalname || file.name,
                    s3Key: s3Key,
                });
            };

            resObj.data = result

        } else if (action === 'get-stream') {
            const s3Key = pathArray.pop() || '';
            // logger.info('handleFileRequest: get-stream action, s3Key:', s3Key);
            const response = await getFileFromS3({ key: s3Key });
            const fileStream = response.Body;

            if (!fileStream) {
                return res.status(404).json({ error: 'File not found' });
            }

            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Cache-Control', 'private, max-age=3600');

            fileStream.on('error', (err) => {
                logger.error('S3 stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Stream failed' });
                } else {
                    res.end();
                }
            });

            return fileStream.pipe(res);
        }

        resObj.success = true;
        resObj.message = 'File request handled successfully';
        res.json(resObj);
    } catch (error) {
        logger.error('handleFileRequest: Error occurred:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }

};



/**
 * Extracts a S3-safe Content-Type and a simplified media category from a file object.
 * Supports Multer files (mimetype/originalname) and browser File objects (type/name).
 */
export const getFileMediaInfo = (file) => {

    const EXTENSION_TO_MIME = {
        // Images
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        // Video
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        // Audio
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        // Documents & Data
        pdf: 'application/pdf',
        json: 'application/json',
        txt: 'text/plain',
        csv: 'text/csv',
        html: 'text/html',
    };

    const EXACT_MIME_CATEGORIES = {
        'application/pdf': 'pdf',
        'application/json': 'json',
    };

    const PREFIX_CATEGORIES = ['image', 'video', 'audio', 'text'];


    if (!file) {
        return { contentType: 'application/octet-stream', mediaType: 'unknown' };
    }

    // 1. Resolve raw MIME type (handles both Multer `mimetype` and Web File `type`)
    let contentType = (file.mimetype || file.type || '').trim().toLowerCase();

    // 2. Fallback to file extension if MIME type is missing or generic
    if (!contentType || contentType === 'application/octet-stream') {
        const fileName = file.originalname || file.name || '';
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext && EXTENSION_TO_MIME[ext]) {
            contentType = EXTENSION_TO_MIME[ext];
        }
    }

    // Default binary fallback for S3 if still unknown
    if (!contentType) {
        contentType = 'application/octet-stream';
    }

    // 3. Determine simplified media category
    let mediaType = 'unknown';

    if (EXACT_MIME_CATEGORIES[contentType]) {
        mediaType = EXACT_MIME_CATEGORIES[contentType];
    } else {
        const prefix = contentType.split('/')[0];
        if (PREFIX_CATEGORIES.includes(prefix)) {
            mediaType = prefix;
        }
    }

    return { contentType, mediaType };
};