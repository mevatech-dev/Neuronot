-- Initial setup for Neuronot Postgres.
-- This runs once when the container is first created.
--
-- uuidv7() is a core PostgreSQL 18 function — no extension required.
-- pgcrypto is intentionally not installed: encrypted audit columns
-- (consents.ip_encrypted, consents.device_id_encrypted) are encrypted in
-- the Go layer with AES-256-GCM (see internal/crypto/aesgcm), and bcrypt
-- password hashes are produced by golang.org/x/crypto/bcrypt before they
-- ever touch SQL.

CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

