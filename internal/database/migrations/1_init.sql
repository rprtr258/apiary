-- +goose up
CREATE TABLE IF NOT EXISTS request (
    id      TEXT NOT NULL,
    kind    TEXT NOT NULL,
    PRIMARY KEY (id),
    CHECK (id != ''),
    CHECK (kind IN ('http', 'sql', 'jq', 'md', 'redis', 'grpc'))
);
CREATE TABLE IF NOT EXISTS response (
    id          TEXT NOT NULL,
    pos         INTEGER NOT NULL,
    sent_at     DATETIME NOT NULL,
    received_at DATETIME NOT NULL,
    PRIMARY KEY (id, pos),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (pos >= 0)
);
CREATE TABLE IF NOT EXISTS request_http (
    id      TEXT NOT NULL,
    url     TEXT NOT NULL,
    method  TEXT NOT NULL,
    body    TEXT NOT NULL,
    headers JSONB NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (method = UPPER(method))
);
CREATE TABLE IF NOT EXISTS response_http (
    id      TEXT NOT NULL,
    pos     INTEGER NOT NULL,
    code    INTEGER NOT NULL,
    body    TEXT,
    headers JSONB NOT NULL,
    PRIMARY KEY (id, pos),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (pos >= 0),
    CHECK (code >= 100 AND code < 600)
);
CREATE TABLE IF NOT EXISTS request_sql (
    id       TEXT NOT NULL,
    dsn      TEXT NOT NULL,
    database TEXT NOT NULL,
    query    TEXT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (database IN ('postgres', 'mysql', 'sqlite', 'clickhouse'))
);
CREATE TABLE IF NOT EXISTS response_sql (
    id      TEXT NOT NULL,
    pos     INTEGER NOT NULL,
    columns JSONB NOT NULL,
    types   JSONB NOT NULL,
    rows    JSONB NOT NULL,
    PRIMARY KEY (id, pos),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (pos >= 0)
);
CREATE TABLE IF NOT EXISTS request_jq (
    id TEXT NOT NULL,
    query TEXT NOT NULL,
    json TEXT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (id) REFERENCES request(id)
);
CREATE TABLE IF NOT EXISTS response_jq (
    id       TEXT NOT NULL,
    pos      INTEGER NOT NULL,
    response JSONB NOT NULL,
    PRIMARY KEY (id, pos),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (pos >= 0)
);
CREATE TABLE IF NOT EXISTS request_md (
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (id) REFERENCES request(id)
);
CREATE TABLE IF NOT EXISTS request_redis (
    id TEXT NOT NULL,
    dsn TEXT NOT NULL,
    query TEXT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (id) REFERENCES request(id)
);
CREATE TABLE IF NOT EXISTS response_redis (
    id       TEXT NOT NULL,
    pos      INTEGER NOT NULL,
    response TEXT NOT NULL,
    PRIMARY KEY (id, pos),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (pos >= 0)
);
CREATE TABLE IF NOT EXISTS request_grpc (
    id TEXT NOT NULL,
    target TEXT NOT NULL,
    method TEXT NOT NULL, -- TODO: package, service, method
    payload TEXT NOT NULL,
    metadata JSONB NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (id) REFERENCES request(id)
);
CREATE TABLE IF NOT EXISTS response_grpc (
    id       TEXT NOT NULL,
    pos      INTEGER NOT NULL,
    code     INTEGER NOT NULL,
    response TEXT NOT NULL,
    metadata JSONB NOT NULL,
    PRIMARY KEY (id, pos),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (pos >= 0),
    CHECK (code >= 0)
);

-- +goose down
DROP TABLE IF EXISTS response_grpc;
DROP TABLE IF EXISTS request_grpc;
DROP TABLE IF EXISTS response_redis;
DROP TABLE IF EXISTS request_redis;
DROP TABLE IF EXISTS request_md;
DROP TABLE IF EXISTS response_jq;
DROP TABLE IF EXISTS request_jq;
DROP TABLE IF EXISTS response_sql;
DROP TABLE IF EXISTS request_sql;
DROP TABLE IF EXISTS response_http;
DROP TABLE IF EXISTS request_http;
DROP TABLE IF EXISTS response;
DROP TABLE IF EXISTS request;
