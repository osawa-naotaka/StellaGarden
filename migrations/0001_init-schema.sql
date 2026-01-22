-- Migration number: 0001 	 2025-12-08T11:24:00.645Z

-- usersテーブルの作成
DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    timezone INT NOT NULL,
    version INT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CHECK (version >= 1)
);

-- auth_tokensテーブルの作成
DROP TABLE IF EXISTS auth_tokens;
CREATE TABLE IF NOT EXISTS auth_tokens (
    token VARCHAR(64) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
