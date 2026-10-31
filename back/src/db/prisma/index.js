import { PrismaClient } from '#src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg'
import { logger } from '#src/utils/logger.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const Prisma = new PrismaClient({
    adapter,
    // log: ['query', 'error', 'warn'],
})


export default Prisma;