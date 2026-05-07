// api/internal/consents/service.go
package consents

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var ErrUnknownType = errors.New("unknown consent type")

type repository interface {
	Record(ctx context.Context, userID uuid.UUID, t ConsentType, granted bool, version string, rc RecordContext) error
	RecordTx(ctx context.Context, tx DBTX, userID uuid.UUID, t ConsentType, granted bool, version string, rc RecordContext) error
	LatestPerType(ctx context.Context, userID uuid.UUID) ([]Consent, error)
	Latest(ctx context.Context, userID uuid.UUID, t ConsentType) (*Consent, error)
}

type Service struct {
	repo repository
}

func NewService(repo repository) *Service {
	return &Service{repo: repo}
}

// IsGranted returns true only when the latest row is granted=true AND its
// version matches the current canonical version.
func (s *Service) IsGranted(ctx context.Context, userID uuid.UUID, t ConsentType) (bool, error) {
	if !t.IsValid() {
		return false, ErrUnknownType
	}
	c, err := s.repo.Latest(ctx, userID, t)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return false, nil
		}
		return false, err
	}
	if !c.Granted {
		return false, nil
	}
	return c.Version == CurrentVersions[t], nil
}

// Grant records a granted=true row for the user.
func (s *Service) Grant(ctx context.Context, userID uuid.UUID, t ConsentType, rc RecordContext) error {
	if !t.IsValid() {
		return ErrUnknownType
	}
	return s.repo.Record(ctx, userID, t, true, CurrentVersions[t], rc)
}

// Revoke records a granted=false row.
func (s *Service) Revoke(ctx context.Context, userID uuid.UUID, t ConsentType, rc RecordContext) error {
	if !t.IsValid() {
		return ErrUnknownType
	}
	return s.repo.Record(ctx, userID, t, false, CurrentVersions[t], rc)
}

// GrantTx is used during registration to bundle inserts into the same tx
// that creates the user.
func (s *Service) GrantTx(ctx context.Context, tx DBTX, userID uuid.UUID, t ConsentType, rc RecordContext) error {
	if !t.IsValid() {
		return ErrUnknownType
	}
	return s.repo.RecordTx(ctx, tx, userID, t, true, CurrentVersions[t], rc)
}

// All returns the current state for every known type, with CurrentVersion
// inlined so clients can detect stale grants.
func (s *Service) All(ctx context.Context, userID uuid.UUID) ([]ConsentResponse, error) {
	rows, err := s.repo.LatestPerType(ctx, userID)
	if err != nil {
		return nil, err
	}
	byType := make(map[ConsentType]Consent, len(rows))
	for _, c := range rows {
		byType[c.Type] = c
	}
	out := make([]ConsentResponse, 0, len(AllTypes))
	for _, t := range AllTypes {
		c, ok := byType[t]
		if !ok {
			out = append(out, ConsentResponse{
				Type:           t,
				Granted:        false,
				Version:        "",
				CurrentVersion: CurrentVersions[t],
				Source:         "",
				OccurredAt:     nil,
			})
			continue
		}
		occ := c.OccurredAt // copy to avoid pointing at the range variable
		out = append(out, ConsentResponse{
			Type:           c.Type,
			Granted:        c.Granted,
			Version:        c.Version,
			CurrentVersion: CurrentVersions[t],
			Source:         c.Source,
			OccurredAt:     &occ,
		})
	}
	return out, nil
}
