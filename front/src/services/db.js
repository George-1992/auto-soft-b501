import { logger } from '@/src/services/logger'
import Dexie from 'dexie'

const PWA_DB_NAME = import.meta.env.VITE_PWA_DB_NAME || 'pwa_db'
const db = new Dexie(PWA_DB_NAME)

db.version(1).stores({
    all: '[itsFor+id], itsFor, updatedAt',
    outbox: '++id, itsFor, action',
})

export default db

export const localDataSync = async ({
    itsFor = '',
    action = '',
    data = null,
    isOnline = false,
}) => {
    let resObj = {
        success: false,
        message: 'Data sync failed',
        data: null,
    }
    const tableName = itsFor || '';

    try {
        // logger.info('dataSync: syncing data to local db for table:', tableName, 'data:', data)

        if (!tableName) throw new Error('itsFor is required')

        const items = data ? [].concat(data) : []

        if (action === 'get') {
            resObj.data = await db.all.where('itsFor').equals(tableName).toArray();

        } else if (action === 'create' || action === 'update') {
            const rows = items.map(item => ({
                ...item,
                id: item.id ?? crypto.randomUUID(),
                itsFor: tableName,
            }))
            await db.all.bulkPut(rows)

        } else if (action === 'delete') {
            await db.all.bulkDelete(items.map(item => [tableName, item.id]))

        } else {
            logger.error('dataSync: unknown action');
            resObj.message = 'no action';
        }

        if (!isOnline) {
            // add to outbox for later sync
            if (action === 'create' || action === 'update' || action === 'delete') {
                await db.outbox.put({
                    itsFor: tableName,
                    action,
                    data,
                })
            }
        } else {
            // if online, sync outbox data to backend
            syncOutboxData();
        }

        resObj.success = true;
        resObj.message = 'Data sync successful';
        return resObj;

    } catch (error) {
        logger.error('dataSync error', error)
        resObj.success = false
        resObj.message = error.message || 'Unknown error'
        resObj.data = error
    }
    return resObj
};

export const syncOutboxData = async () => {
    try {
        const unsyncedOutboxData = await db.outbox.toArray();

        if (unsyncedOutboxData.length > 0) {
            logger.info('syncOutboxData: syncing outbox data to backend:', unsyncedOutboxData);

            for (const item of unsyncedOutboxData) {
                const { itsFor, action, data } = item;

                const resObj = await sendBackRequest({
                    itsFor,
                    action,
                    data,
                });

                if (resObj.success) {
                    await db.outbox.delete(item.id);
                }
            }
        } else {
            logger.info('syncOutboxData: no unsynced outbox data found');
        }

    } catch (error) {
        logger.error('syncOutboxData error', error);
    }
};