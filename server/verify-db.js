import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

console.log('--- DB VERIFICATION START ---');
console.log('DATABASE_URL:', process.env.DATABASE_URL || 'UNDEFINED');

const prisma = new PrismaClient({
    log: ['info', 'warn', 'error'],
});

async function main() {
    try {
        console.log('Attempting to connect to database...');
        await prisma.$connect();
        console.log('✅ Connected to database successfully.');

        const count = await prisma.voice.count();
        console.log('✅ Voice table count:', count);

        const users = await prisma.user.count();
        console.log('✅ User table count:', users);

    } catch (error) {
        console.error('❌ Connection failed:', error);
    } finally {
        await prisma.$disconnect();
        console.log('--- DB VERIFICATION END ---');
    }
}

main();
