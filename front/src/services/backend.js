import { GLOBALS } from "@/globals";
import { handleSignout } from "@/src/components/auth";
import { localDataSync } from "@/src/services/db";
import { logger } from "@/src/services/logger";
import { internetConnection } from "@/src/services/validation";

const VITE_API_URL = import.meta.env.VITE_API_URL || '';
const IS_DEV = GLOBALS.IS_DEV;

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
}) => {
    let resObj = {
        success: false,
        message: 'Unknown error',
        data: null,
        status: 'unknown',
    }
    try {

        let toSendData = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: {
                itsFor: itsFor,
                action: action,
            }
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            toSendData.body.data = data;
        }


        // check if there is internet connection before sending the request
        const inetConnection = await internetConnection();
        // logger.info('sendBackRequest: internetConnection:', inetConnection);
        // logger.info('sendBackRequest: toSendData:', toSendData);



        if (inetConnection) {
            // get data from backend and then 
            let response = await fetch(endpoint(), {
                credentials: 'include',
                ...toSendData,
                body: JSON.stringify(toSendData.body),
            });

            //sync it to local db
            resObj = await response.json();

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