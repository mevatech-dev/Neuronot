// api/internal/account/service_test.go
package account

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type fakeRepo struct {
	email     string
	hash      string
	getErr    error
	updateErr error
	deleteErr error

	updatedHash string
	deleted     bool
}

func (f *fakeRepo) GetEmailAndHash(_ context.Context, _ uuid.UUID) (string, string, error) {
	return f.email, f.hash, f.getErr
}
func (f *fakeRepo) UpdatePassword(_ context.Context, _ uuid.UUID, h string) error {
	f.updatedHash = h
	return f.updateErr
}
func (f *fakeRepo) DeleteUser(_ context.Context, _ uuid.UUID) error {
	f.deleted = true
	return f.deleteErr
}

type fakeTokens struct{ revoked bool }

func (f *fakeTokens) RevokeAllForUser(_ context.Context, _ uuid.UUID) error {
	f.revoked = true
	return nil
}

func mustHash(t *testing.T, pw string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	return string(h)
}

func TestChangePassword_Success(t *testing.T) {
	repo := &fakeRepo{email: "a@b.com", hash: mustHash(t, "current8x")}
	tokens := &fakeTokens{}
	svc := NewService(repo, tokens)
	if err := svc.ChangePassword(context.Background(), uuid.New(), "current8x", "newpass8x"); err != nil {
		t.Fatal(err)
	}
	if repo.updatedHash == "" {
		t.Fatal("password not updated")
	}
	if !tokens.revoked {
		t.Fatal("refresh tokens not revoked")
	}
}

func TestChangePassword_WrongCurrent(t *testing.T) {
	repo := &fakeRepo{email: "a@b.com", hash: mustHash(t, "current8x")}
	svc := NewService(repo, &fakeTokens{})
	err := svc.ChangePassword(context.Background(), uuid.New(), "wrong8888", "newpass8x")
	if !errors.Is(err, ErrPasswordIncorrect) {
		t.Fatalf("got %v, want ErrPasswordIncorrect", err)
	}
}

func TestChangePassword_WeakNew(t *testing.T) {
	svc := NewService(&fakeRepo{hash: mustHash(t, "current8x")}, &fakeTokens{})
	err := svc.ChangePassword(context.Background(), uuid.New(), "current8x", "short")
	if !errors.Is(err, ErrPasswordWeak) {
		t.Fatalf("got %v, want ErrPasswordWeak", err)
	}
}

func TestDeleteSelf_EmailMatch(t *testing.T) {
	repo := &fakeRepo{email: "Ada@example.com", hash: "x"}
	svc := NewService(repo, &fakeTokens{})
	if err := svc.DeleteSelf(context.Background(), uuid.New(), "ada@example.com"); err != nil {
		t.Fatal(err)
	}
	if !repo.deleted {
		t.Fatal("user not deleted")
	}
}

func TestDeleteSelf_EmailMismatch(t *testing.T) {
	repo := &fakeRepo{email: "ada@example.com", hash: "x"}
	svc := NewService(repo, &fakeTokens{})
	err := svc.DeleteSelf(context.Background(), uuid.New(), "wrong@example.com")
	if !errors.Is(err, ErrEmailMismatch) {
		t.Fatalf("got %v, want ErrEmailMismatch", err)
	}
}
