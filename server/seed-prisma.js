
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

const prisma = new PrismaClient();

const algorithm = 'aes-256-ctr';
const secretKey = crypto.createHash('sha256').update(process.env.ENCRYPTION_SECRET || 'dev-encryption-secret-key-change-in-production-32-chars-long').digest();

const encrypt = (text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return iv.toString('hex') + ':' + crypted;
};

async function main() {
    console.log('Seeding database with Prisma...');

    const userData = [
        { username: 'john', password: 'password1', firstName: 'John', lastName: 'Doe', status: 1, sipUsername: 'john_sip', sipPassword: 'sip_password1' },
        { username: 'phillip1995', password: 'password2', firstName: 'Phillip', lastName: 'Smith', status: 1, sipUsername: 'phillip1995', sipPassword: 'avaya123' },
        { username: 'test1991', password: 'password3', firstName: 'Steve', lastName: 'Johnson', status: 1, sipUsername: 'steve_sip', sipPassword: 'sip_password3' },
    ];

    for (const u of userData) {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        const encryptedSipPassword = encrypt(u.sipPassword);

        // Check if user exists first to avoid duplicates if re-run without force
        const existing = await prisma.user.findUnique({ where: { username: u.username } });
        if (!existing) {
            await prisma.user.create({
                data: {
                    username: u.username,
                    password: hashedPassword,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    status: u.status,
                    sipUsername: u.sipUsername,
                    sipPassword: encryptedSipPassword,
                    avatar: null
                }
            });
            console.log(`Created user: ${u.username}`);
        } else {
            console.log(`User already exists: ${u.username}`);
        }
    }

    console.log('Database seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
