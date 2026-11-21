import { logger } from "#src/utils/logger.js";

export const getRequestContext = (req) => {
    let d = {
        reqObj: req.body || {},
        itsFor: '',
        action: '',
        searchQuery: '',
        accountId: null,
        userId: null,
        offset: 0,
        limit: 50,
        files: [],
        isFormData: false,
    }
    try {

        let body = req.body || {};
        // logger.info('getRequestContext:  req.body | :', req.body);

        const isFileUpload = req.is('multipart/form-data') || req.files || req.file;
        // logger.info('getRequestContext: isFileUpload:', isFileUpload);

        if (isFileUpload || typeof body.payload === 'string') {
            d.isFormData = true;

            let meta = {};
            try {
                meta = JSON.parse(body.payload || '{}');
            } catch (parseError) {
                logger.error('getRequestContext: invalid payload JSON:', parseError);
            }

            // auth is set by middleware on req.body, never trust it from the client payload
            delete meta.auth;
            body = { ...meta, auth: req.body?.auth };

            d.files = Array.isArray(req.files)
                ? req.files
                : req.files
                    ? Object.values(req.files).flat()
                    : req.file
                        ? [req.file]
                        : [];
        }

        d.reqObj = body;
        d.itsFor = body.itsFor || '';
        d.action = body.action || '';
        d.searchQuery = body.searchQuery || '';
        d.accountId = body.auth?.accountId || null;
        d.userId = body.auth?.userId || null;
        d.offset = parseInt(body.offset) || 0;
        d.limit = parseInt(body.limit) || 50;

        d.searchParams = getSearchParams(req) || {};
        d.pathArray = getPathArray(req) || [];

        return { ...d };

    } catch (error) {
        logger.error('getRequestContext: error:', error);
    }
    return { ...d };
};

export const getSearchParams = (req) => {
    try {
        const query = req?.query;
        if (!query || typeof query !== 'object') {
            return {};
        }

        // Shallow clone works safely even on null-prototype objects
        return { ...query };
    } catch (error) {
        logger.error('getSearchParams: error:', error);
        return {};
    }
};

export const getPathArray = (req) => {
    try {
        const path = req?.path || '';
        const pathArray = path.split('/').filter(Boolean);
        return pathArray;
    } catch (error) {
        logger.error('getPathArray: error:', error);
        return [];
    }
};