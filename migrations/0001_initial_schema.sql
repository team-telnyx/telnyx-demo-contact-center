-- Cloudflare D1 Migration: Initial Schema
-- This creates the database schema for the contact center application

-- Users table
CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    phoneNumber TEXT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 0,
    avatar BLOB,
    sipUsername TEXT NOT NULL,
    sipPassword TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Voices table (call queue management)
CREATE TABLE IF NOT EXISTS Voices (
    uuid TEXT PRIMARY KEY,
    direction TEXT,
    telnyx_number TEXT,
    destination_number TEXT,
    queue_name TEXT,
    accept_agent TEXT,
    transfer_agent TEXT,
    bridge_uuid TEXT,
    queue_uuid TEXT,
    supervisor_call_id TEXT,
    status TEXT DEFAULT 'queued',
    transfer_status TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Call Sessions table
CREATE TABLE IF NOT EXISTS call_sessions (
    id TEXT PRIMARY KEY,
    sessionKey TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',
    direction TEXT,
    from_number TEXT,
    to_number TEXT,
    started_at TEXT,
    ended_at TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Call Legs table
CREATE TABLE IF NOT EXISTS call_legs (
    id TEXT PRIMARY KEY,
    call_control_id TEXT NOT NULL UNIQUE,
    sessionKey TEXT NOT NULL,
    leg_type TEXT NOT NULL,
    direction TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    accepted_by TEXT,
    hangup_source TEXT,
    hangup_cause TEXT,
    start_time TEXT,
    end_time TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sessionKey) REFERENCES call_sessions(sessionKey) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Conversations table
CREATE TABLE IF NOT EXISTS Conversations (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL UNIQUE,
    from_number TEXT,
    to_number TEXT,
    agent_assigned TEXT,
    assigned INTEGER,
    tag TEXT,
    last_message TEXT,
    last_read_at TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Messages table
CREATE TABLE IF NOT EXISTS Messages (
    id TEXT PRIMARY KEY,
    direction TEXT NOT NULL,
    type TEXT NOT NULL,
    telnyx_number TEXT NOT NULL,
    destination_number TEXT NOT NULL,
    text_body TEXT,
    media TEXT,
    tag TEXT,
    conversation_id TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES Conversations(conversation_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON Users(username);
CREATE INDEX IF NOT EXISTS idx_voices_status ON Voices(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_sessionKey ON call_sessions(sessionKey);
CREATE INDEX IF NOT EXISTS idx_call_legs_sessionKey ON call_legs(sessionKey);
CREATE INDEX IF NOT EXISTS idx_call_legs_call_control_id ON call_legs(call_control_id);
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON Conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_assigned ON Conversations(agent_assigned);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON Messages(conversation_id);
