import { GLOBALS } from "@/globals";
import { handleSignout } from "@/src/components/auth";
import { localDataSync } from "@/src/services/db";
import { logger } from "@/src/services/logger";
import { internetConnection } from "@/src/services/validation";

const VITE_API_URL = import.meta.env.VITE_API_URL || '';
const IS_DEV = GLOBALS.IS_DEV;

// logger.info('backend service initialized', { VITE_API_URL, IS_DEV });

export const endpoint = () => {
    // const protocol = IS_DEV ? 'http' : 'https';
    const url = `${VITE_API_URL}`;
    return url;
};

export const sendBackRequest = async ({
    itsFor = '',
    action = '',
    method = 'POST',
    data = null,
    searchQuery = '',
    offset = 0,
    limit = 50,
    filters = [],
    include = {},
    formData = null,
}) => {
    let resObj = {
        success: false,
        message: 'Unknown error',
        data: null,
        status: 'unknown',
    }
    try {

        //dummy await
        // await new Promise(resolve => setTimeout(resolve, 10000));

        const meta = {
            itsFor: itsFor,
            action: action,
            offset: offset,
            limit: limit,
            filters: filters,
            include: include,
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            meta.data = data;
        }
        if (searchQuery) {
            meta.searchQuery = searchQuery;
        }

        const headers = {
            'X-Client-Url': window.location.href,
        };

        let body;
        if (formData instanceof FormData) {
            // do not set Content Type, the browser adds it with the multipart boundary
            formData.set('payload', JSON.stringify(meta));
            body = formData;
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(meta);
        }

        const toSendData = {
            method: method,
            headers: headers,
            body: body,
        };

        // check if there is internet connection before sending the request
        const inetConnection = await internetConnection();
        // logger.info('sendBackRequest: internetConnection:', inetConnection);
        // logger.info('sendBackRequest: toSendData:', toSendData);

        if (inetConnection) {
            // get data from backend and then 
            let response = await fetch(endpoint(), {
                credentials: 'include',
                ...toSendData,
            });
            const isStream = response.headers.get('Content-Type')?.includes('text/event-stream');
            if (isStream) {
                return response;
            } else {
                resObj = await response.json();
            }


            //sync it to local db
            if (resObj.success) {
                // logger.info('sendBackRequest: syncing data to local db');
                localDataSync({
                    itsFor: itsFor,
                    action: action || 'create',
                    data: resObj.data,
                });
                // logger.info('sendBackRequest: dataSync result:', syncRes);
            } else {
                logger.error('sendBackRequest: no data to sync to local db');
            }

        } else {
            if (formData) {
                // files cannot be synced to the local db
                return {
                    ...resObj,
                    message: 'No internet connection, file upload requires being online',
                    status: 'offline',
                };
            }
            // logger.info('sendBackRequest: action is not get, so adding dataSync to thisActions');
            resObj = await localDataSync({
                itsFor: itsFor,
                action: action,
                data: resObj.data,
            });
        }

        // logger.info('sendBackRequest 5: resObj:', resObj);
        //if unauthorized, signout user
        if (resObj.status === 'unauthorized') {
            logger.info('sendBackRequest: unauthorized, signing out user');
            return await handleSignout();
        }

    } catch (error) {
        logger.error('sendBackRequest error', error);
        resObj.message = error.message || 'Unknown error';
        resObj.status = error.status || 'error';
    }

    return resObj;
};