-- Migration: Initial schema
-- Created at: 2016-05-20 18:09:08
-- ====  UP  ====

BEGIN;

    CREATE TABLE events (
        "timestamp" timestamp without time zone NOT NULL,
        group_key character varying(64) NOT NULL,
        content text NOT NULL
    );

    CREATE TABLE group_keys (
        value character varying(100) NOT NULL
    );

    CREATE TABLE snapshots (
        "timestamp" timestamp without time zone NOT NULL,
        group_key character varying(64) NOT NULL,
        content text NOT NULL
    );

    ALTER TABLE ONLY group_keys
        ADD CONSTRAINT group_keys_pkey PRIMARY KEY (value);

COMMIT;

-- ==== DOWN ====

BEGIN;

    DROP TABLE events;

    DROP TABLE group_keys;

    DROP TABLE snapshots;

COMMIT;
