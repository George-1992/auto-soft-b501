import { logger } from '#src/utils/logger.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
 
export const getErrorMessage = (error) => {
    try {
        if (error == null) return 'Unknown error';
        if (typeof error === 'string') return error;

        const messages = [];
        const seenErrors = new Set();
        let current = error;
        let maxTraceDepth = 100;

        while (current && maxTraceDepth-- > 0) {
            // 1. Prevent circular object reference loops
            if (typeof current === 'object' && seenErrors.has(current)) {
                break;
            }
            if (typeof current === 'object') {
                seenErrors.add(current);
            }

            // 2. Extract meaningful message from current error level
            let value;
            if (typeof current === 'string') {
                value = current;
            } else if (current instanceof Error || typeof current?.message === 'string') {
                value = current.message;
            } else if (typeof current === 'object') {
                try {
                    value = JSON.stringify(current);
                } catch {
                    value = String(current);
                }
            } else {
                value = String(current);
            }

            // 3. Deduplicate consecutive identical messages
            if (value && messages[messages.length - 1] !== value) {
                messages.push(value);
            }

            // 4. Traverse cause chain
            current = typeof current === 'object' && current !== null ? current.cause : null;
        }

        return messages.length > 0 ? messages.join('\n') : String(error);
    } catch (err) {
        logger?.error('Error while extracting error message:', err);
        return 'Unknown error';
    }
};


const DATABASE_URL = process.env.DATABASE_URL;
export const db = drizzle({
    connection: DATABASE_URL,
    casing: 'snake_case',
    schema,
    relations: schema.relations,
});


export { desc } from 'drizzle-orm';
export default db;