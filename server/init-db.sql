-- Create Users table
CREATE TABLE IF NOT EXISTS "Users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "username" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "avatar" BLOB,
    "sipUsername" TEXT NOT NULL,
    "sipPassword" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert phillip1995 user
INSERT INTO "Users" (username, password, firstName, lastName, phoneNumber, sipUsername, sipPassword, avatar, status)
VALUES (
    'phillip1995',
    '$2a$10$CeS1SIKZ4LlsRilY3HUvZecaDjfrmntejNDMXF4wjdddsKh7fCXeq',
    'Phillip',
    'Smith',
    NULL,
    'phillip1995',
    'c10efda3f93c036590af558f95288116:1f9079cc6875e166',
    NULL,
    1
);
