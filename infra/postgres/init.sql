-- Initial setup for Neuronot Postgres.
-- This runs once when the container is first created.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email
