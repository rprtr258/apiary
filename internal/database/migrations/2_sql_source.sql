-- +goose up
CREATE TABLE IF NOT EXISTS source_sql (
    id       TEXT NOT NULL,
    dsn      TEXT NOT NULL,
    database TEXT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (id) REFERENCES request(id),
    CHECK (database IN ('postgres', 'mysql', 'sqlite', 'clickhouse'))
);

-- +goose down
DROP TABLE IF EXISTS source_sql;
