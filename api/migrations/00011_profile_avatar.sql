-- +goose Up
-- Profile avatar: object key into Cloudflare R2 (see ADR 0002). The full
-- URL is never stored — the client requests a fresh pre-signed GET when
-- it needs to render the image.
ALTER TABLE profiles
  ADD COLUMN avatar_key text;

-- +goose Down
ALTER TABLE profiles
  DROP COLUMN avatar_key;
