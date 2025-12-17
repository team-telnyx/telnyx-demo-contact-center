import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const userCount = await prisma.user.count();
        console.log(`Total users: ${userCount}`);

        if (userCount > 0) {
            const users = await prisma.user.findMany({
                select: { username: true, id: true }
            });
            console.log('Users found:', users);
        } else {
            console.log('No users found in database.');
        }
    } catch (error) {
        console.error('Error checking users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
