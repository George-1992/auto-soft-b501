
import Prisma from "#src/db/prisma/index.js";
import { logger } from "#src/utils/logger.js";
import { tool } from "ai";
import { z } from "zod";


export const createDbRequestTool = ({ accountId, workspaceId }) => tool({
    description: 'Query database tables using Prisma-style query options. Account scope is applied automatically.',
    inputSchema: z.object({
        table: z
            .enum(['notes'])
            .default('notes')
            .describe('Target Prisma model to run findMany against'),
        where: z
            .object({
                id: z.string().optional(),
                title: z.string().optional(),
                content: z.string().optional(),
                accountId: z.string().optional(),
                workspaceId: z.string().optional(),
            })
            .default({})
            .describe('Optional notes filters. accountId is injected server-side.'),
        limit: z
            .coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(20)
            .describe('Maximum number of records to return'),
        offset: z
            .coerce.number()
            .int()
            .min(0)
            .default(0)
            .describe('Number of records to skip'),
        orderBy: z
            .object({
                field: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
                direction: z.enum(['asc', 'desc']).default('desc'),
            })
            .optional()
            .describe('Sort configuration for notes'),
    }),
    execute: async ({ table, where, limit, offset, orderBy }) => {
        try {
            logger.info('=======  TOOL START: dbRequestTool ======');

            if (!accountId) {
                logger.error('DB Request Tool: missing accountId in server context');
                return [];
            }

            const whereClause = {
                ...(where || {}),
                accountId,
            };

            if (table !== 'notes') {
                logger.error('DB Request Tool: unsupported table requested:', table);
                return [];
            }

            const result = await Prisma.notes.findMany({
                where: whereClause,
                ...(typeof limit === 'number' ? { take: limit } : {}),
                ...(typeof offset === 'number' ? { skip: offset } : {}),
                ...(orderBy?.field && orderBy?.direction
                    ? { orderBy: { [orderBy.field]: orderBy.direction } }
                    : {}),
            });

            return result;

        } catch (error) {
            logger.error('DB Request Tool Error:', error?.message || error);
            return error?.message || 'error getting data';
        }
    },
});

export const createPartsSearchTool = ({ workspaceId }) => tool({
    description: 'Search parts in the database by part numbers. Only call this with real part numbers found by findPartNumbers. Never call it with a part name or a guess.',
    inputSchema: z.object({
        partNumbers: z.array(z.string()).min(1).describe('Real OEM or aftermarket part numbers returned by findPartNumbers.'),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
    }),
    execute: async ({ partNumbers, limit, offset }) => {
        try {
            logger.info('=======  TOOL START: partsSearchTool ======');
            logger.info({ partNumbers, limit, offset });

            const result = await Prisma.parts.findMany({
                where: {
                    workspaceId,
                    OR: [
                        { partNumbers: { hasSome: partNumbers } },
                        { sku: { in: partNumbers } },
                    ],
                },
                take: limit,
                skip: offset,
                orderBy: { updatedAt: 'desc' },
            });

            logger.info('result from partsSearchTool:', result);
            return result;
        } catch (error) {
            logger.error('Parts Search Tool Error:', error?.message || error);
            return { error: error?.message || 'error searching parts' };
        }
    },
});

export const createFindPartNumbersTool = ({ workspaceId }) => tool({
    description: 'Find OEM and aftermarket part numbers for a specific vehicle and part. Call this first, before searching parts.',
    inputSchema: z.object({
        make: z.string(),
        model: z.string(),
        year: z.number().int(),
        engine: z.string().nullable(),
        part: z.string().describe('Part name, e.g. "front brake pads"'),
    }),
    execute: async ({ make, model, year, engine, part }) => {
        // query your fitment source here and return { partNumbers: [...] }
        return { partNumbers: [] };
    },
});