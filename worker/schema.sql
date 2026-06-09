DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    email_verified INTEGER DEFAULT 0,
    pending_email TEXT,
    password_hash TEXT,
    created_at INTEGER,
    last_login_at INTEGER,
    verification_code TEXT,
    verification_expires INTEGER
);

DROP TABLE IF EXISTS user_data;
CREATE TABLE user_data (
    user_id TEXT,
    key TEXT,
    value TEXT, -- JSON content
    updated_at INTEGER,
    deleted INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, key)
);
CREATE INDEX idx_user_data_updated ON user_data(user_id, updated_at);

-- New Table for Share Codes
DROP TABLE IF EXISTS share_codes;
CREATE TABLE share_codes (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER,
    expires_at INTEGER
);

-- Community Wildcards
DROP TABLE IF EXISTS public_wildcards;
CREATE TABLE public_wildcards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT,
    author_name TEXT,
    description TEXT,
    tags TEXT,
    created_at INTEGER,
    downloads INTEGER DEFAULT 0
);
CREATE INDEX idx_public_wildcards_created ON public_wildcards(created_at);
CREATE INDEX idx_public_wildcards_downloads ON public_wildcards(downloads);
