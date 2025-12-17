-- D1 Database Schema
-- Generated from Prisma schema

-- Users table
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

-- Voices table
CREATE TABLE IF NOT EXISTS "Voices" (
    "uuid" TEXT PRIMARY KEY,
    "direction" TEXT,
    "telnyx_number" TEXT,
    "destination_number" TEXT,
    "queue_name" TEXT,
    "accept_agent" TEXT,
    "transfer_agent" TEXT,
    "bridge_uuid" TEXT,
    "queue_uuid" TEXT,
    "supervisor_call_id" TEXT,
    "status" TEXT DEFAULT 'queued',
    "transfer_status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Voices_status_idx" ON "Voices"("status");

-- CallSessions table
CREATE TABLE IF NOT EXISTS "call_sessions" (
    "id" TEXT PRIMARY KEY,
    "sessionKey" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "direction" TEXT,
    "from_number" TEXT,
    "to_number" TEXT,
    "started_at" DATETIME,
    "ended_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "call_sessions_sessionKey_idx" ON "call_sessions"("sessionKey");

-- CallLegs table
CREATE TABLE IF NOT EXISTS "call_legs" (
    "id" TEXT PRIMARY KEY,
    "call_control_id" TEXT NOT NULL UNIQUE,
    "sessionKey" TEXT NOT NULL,
    "leg_type" TEXT NOT NULL,
    "direction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "accepted_by" TEXT,
    "hangup_source" TEXT,
    "hangup_cause" TEXT,
    "start_time" DATETIME,
    "end_time" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("sessionKey") REFERENCES "call_sessions"("sessionKey") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "call_legs_call_control_id_idx" ON "call_legs"("call_control_id");
CREATE INDEX IF NOT EXISTS "call_legs_sessionKey_idx" ON "call_legs"("sessionKey");

-- Conversations table
CREATE TABLE IF NOT EXISTS "Conversations" (
    "id" TEXT PRIMARY KEY,
    "conversation_id" TEXT NOT NULL UNIQUE,
    "from_number" TEXT,
    "to_number" TEXT,
    "agent_assigned" TEXT,
    "assigned" INTEGER,
    "tag" TEXT,
    "last_message" TEXT,
    "last_read_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Conversations_conversation_id_idx" ON "Conversations"("conversation_id");
CREATE INDEX IF NOT EXISTS "Conversations_agent_assigned_idx" ON "Conversations"("agent_assigned");

-- Messages table
CREATE TABLE IF NOT EXISTS "Messages" (
    "id" TEXT PRIMARY KEY,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "telnyx_number" TEXT NOT NULL,
    "destination_number" TEXT NOT NULL,
    "text_body" TEXT,
    "media" TEXT,
    "tag" TEXT,
    "conversation_id" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("conversation_id") REFERENCES "Conversations"("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Messages_conversation_id_idx" ON "Messages"("conversation_id");
