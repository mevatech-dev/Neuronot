// api/internal/consents/repository.go
package consents

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuronot/api/internal/crypto/aesgcm"
)

var ErrNotFound = errors.New("consent not found")

type Repository struct {
	pool *pgxpool.Pool
	kek  []byte
}

const consentColumns = `id, user_id, type, granted, version, source, COALESCE(user_agent, ''), occurred_at`

// scanConsent reads a row produced by SELECT consentColumns into c. Used by
// both single-row and multi-row reads.
func scanConsent(row pgx.Row, c *Consent) error {
	var typ, src string
	if err := row.Scan(&c.ID, &c.UserID, &typ, &c.Granted, &c.Version, &src, &c.UserAgent, &c.OccurredAt); err != nil {
		return err
	}
	c.Type = ConsentType(typ)
	c.Source = Source(src)
	return nil
}

func NewRepository(pool *pgxpool.Pool, kek []byte) *Repository {
	if len(kek) != 32 {
		panic("consents.NewRepository: kek must be exactly 32 bytes")
	}
	return &Repository{pool: pool, kek: kek}
}

// DBTX is the subset of pgx that both pgxpool.Pool and pgx.Tx satisfy. It
// lets callers (e.g. auth.Register) thread an existing transaction.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Record inserts a new immutable audit row.
func (r *Repository) Record(
	ctx context.Context,
	userID uuid.UUID,
	t ConsentType,
	granted bool,
	version string,
	rc RecordContext,
) error {
	return r.RecordTx(ctx, r.pool, userID, t, granted, version, rc)
}

// RecordTx is the transaction-aware variant. Used by auth.Register to bundle
// the user creation + 3 consent inserts into a single commit.
func (r *Repository) RecordTx(
	ctx context.Context,
	tx DBTX,
	userID uuid.UUID,
	t ConsentType,
	granted bool,
	version string,
	rc RecordContext,
) error {
	var ipEnc, devEnc []byte
	if rc.IP != "" {
		enc, err := aesgcm.Encrypt(r.kek, []byte(rc.IP))
		if err != nil {
			return fmt.Errorf("encrypt ip: %w", err)
		}
		ipEnc = enc
	}
	if rc.DeviceID != "" {
		enc, err := aesgcm.Encrypt(r.kek, []byte(rc.DeviceID))
		if err != nil {
			return fmt.Errorf("encrypt device_id: %w", err)
		}
		devEnc = enc
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO consents (user_id, type, granted, version, source, ip_encrypted, device_id_encrypted, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, userID, string(t), granted, version, string(rc.Source), ipEnc, devEnc, rc.UserAgent)
	return err
}

// LatestPerType returns the most recent row for each known consent type for
// the given user. Types with no history are absent from the slice.
func (r *Repository) LatestPerType(ctx context.Context, userID uuid.UUID) ([]Consent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT ON (type) `+consentColumns+`
		  FROM consents
		 WHERE user_id = $1
		 ORDER BY type, occurred_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Consent, 0, 3)
	for rows.Next() {
		var c Consent
		if err := scanConsent(rows, &c); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// Latest returns the most recent row of a specific type, or ErrNotFound.
func (r *Repository) Latest(ctx context.Context, userID uuid.UUID, t ConsentType) (*Consent, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+consentColumns+`
		  FROM consents
		 WHERE user_id = $1 AND type = $2
		 ORDER BY occurred_at DESC
		 LIMIT 1
	`, userID, string(t))
	var c Consent
	if err := scanConsent(row, &c); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}
