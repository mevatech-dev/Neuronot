package httpx

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Cursor packs a (timestamp, id) pair into an opaque base64 token so the
// caller doesn't depend on internal field names.  Tie-break by id keeps
// pagination stable when two rows share an exact timestamp.
type Cursor struct {
	At time.Time
	ID uuid.UUID
}

func EncodeCursor(c Cursor) string {
	raw := fmt.Sprintf("%s|%s", c.At.UTC().Format(time.RFC3339Nano), c.ID.String())
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func DecodeCursor(token string) (Cursor, error) {
	if token == "" {
		return Cursor{}, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return Cursor{}, fmt.Errorf("decode cursor: %w", err)
	}
	parts := strings.SplitN(string(raw), "|", 2)
	if len(parts) != 2 {
		return Cursor{}, errors.New("malformed cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return Cursor{}, fmt.Errorf("parse cursor time: %w", err)
	}
	id, err := uuid.Parse(parts[1])
	if err != nil {
		return Cursor{}, fmt.Errorf("parse cursor id: %w", err)
	}
	return Cursor{At: t, ID: id}, nil
}
