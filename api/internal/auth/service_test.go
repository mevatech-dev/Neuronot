package auth

import (
	"errors"
	"testing"

	"github.com/neuronot/api/internal/auth/oidc"
	"github.com/neuronot/api/internal/consents"
)

// These are pure-function tests for the helpers and error mappers in
// service.go — the parts that don't need a Postgres connection. The full
// flow tests (anonymous, apple, google, upgrade*) are covered by the
// Hafta 9 verification runbook against a real API + DB.

func TestTosAndPrivacyGranted(t *testing.T) {
	tests := []struct {
		name string
		in   []ConsentInput
		want bool
	}{
		{name: "both granted", want: true, in: []ConsentInput{
			{Type: string(consents.ConsentTypeTermsOfService), Granted: true},
			{Type: string(consents.ConsentTypePrivacyPolicy), Granted: true},
		}},
		{name: "tos missing", want: false, in: []ConsentInput{
			{Type: string(consents.ConsentTypePrivacyPolicy), Granted: true},
		}},
		{name: "privacy missing", want: false, in: []ConsentInput{
			{Type: string(consents.ConsentTypeTermsOfService), Granted: true},
		}},
		{name: "tos granted=false", want: false, in: []ConsentInput{
			{Type: string(consents.ConsentTypeTermsOfService), Granted: false},
			{Type: string(consents.ConsentTypePrivacyPolicy), Granted: true},
		}},
		{name: "ai_usage alone", want: false, in: []ConsentInput{
			{Type: string(consents.ConsentTypeAIUsage), Granted: true},
		}},
		{name: "empty", want: false, in: nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := tosAndPrivacyGranted(tc.in)
			if got != tc.want {
				t.Errorf("tosAndPrivacyGranted(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}

func TestAIConsentGranted(t *testing.T) {
	if aiConsentGranted([]ConsentInput{
		{Type: string(consents.ConsentTypeAIUsage), Granted: false},
	}) {
		t.Error("ai_usage granted=false should not satisfy")
	}
	if !aiConsentGranted([]ConsentInput{
		{Type: string(consents.ConsentTypeAIUsage), Granted: true},
	}) {
		t.Error("ai_usage granted=true should satisfy")
	}
	if aiConsentGranted([]ConsentInput{
		{Type: string(consents.ConsentTypeTermsOfService), Granted: true},
	}) {
		t.Error("tos consent should not stand in for ai_usage")
	}
}

func TestMapAppleVerifyErr(t *testing.T) {
	tests := []struct {
		name string
		in   error
		want error
	}{
		{name: "nonce mismatch", in: oidc.ErrInvalidNonce, want: ErrAppleNonceMismatch},
		{name: "invalid token", in: oidc.ErrInvalidToken, want: ErrAppleTokenInvalid},
		{name: "invalid audience", in: oidc.ErrInvalidAudience, want: ErrAppleTokenInvalid},
		{name: "invalid issuer", in: oidc.ErrInvalidIssuer, want: ErrAppleTokenInvalid},
		{name: "unsupported alg", in: oidc.ErrUnsupportedAlg, want: ErrAppleTokenInvalid},
		{name: "key not found", in: oidc.ErrKeyNotFound, want: ErrAppleTokenInvalid},
		{name: "jwks unavailable", in: oidc.ErrJWKSUnavailable, want: ErrAppleTokenInvalid},
		{name: "passthrough unknown", in: errors.New("boom"), want: errors.New("boom")},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := mapAppleVerifyErr(tc.in)
			// "passthrough unknown" returns the original; check by message,
			// other cases must match the auth domain sentinel exactly.
			if tc.want.Error() == "boom" {
				if got != tc.in {
					t.Errorf("expected passthrough, got %v", got)
				}
				return
			}
			if !errors.Is(got, tc.want) {
				t.Errorf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestMapGoogleVerifyErr(t *testing.T) {
	tests := []struct {
		name string
		in   error
		want error
	}{
		{name: "email unverified", in: oidc.ErrEmailUnverified, want: ErrGoogleEmailUnverified},
		{name: "invalid token", in: oidc.ErrInvalidToken, want: ErrGoogleTokenInvalid},
		{name: "invalid audience", in: oidc.ErrInvalidAudience, want: ErrGoogleTokenInvalid},
		{name: "invalid issuer", in: oidc.ErrInvalidIssuer, want: ErrGoogleTokenInvalid},
		{name: "unsupported alg", in: oidc.ErrUnsupportedAlg, want: ErrGoogleTokenInvalid},
		{name: "key not found", in: oidc.ErrKeyNotFound, want: ErrGoogleTokenInvalid},
		{name: "jwks unavailable", in: oidc.ErrJWKSUnavailable, want: ErrGoogleTokenInvalid},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := mapGoogleVerifyErr(tc.in)
			if !errors.Is(got, tc.want) {
				t.Errorf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestNormalizeLanguage(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{in: "tr", want: "tr"},
		{in: "TR", want: "tr"},
		{in: "  en  ", want: "en"},
		{in: "klingon", want: "en"}, // unsupported → default
		{in: "", want: "en"},
		{in: "AR", want: "ar"},
	}
	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			got := normalizeLanguage(tc.in)
			if got != tc.want {
				t.Errorf("normalizeLanguage(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestNormalizeEmail(t *testing.T) {
	t.Run("trims and lowercases", func(t *testing.T) {
		got, err := normalizeEmail("  Alice@Example.COM  ")
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if got != "alice@example.com" {
			t.Errorf("got %q", got)
		}
	})
	t.Run("rejects bare strings", func(t *testing.T) {
		_, err := normalizeEmail("notanemail")
		if !errors.Is(err, ErrInvalidEmail) {
			t.Errorf("got %v, want ErrInvalidEmail", err)
		}
	})
	t.Run("rejects empty", func(t *testing.T) {
		_, err := normalizeEmail("   ")
		if !errors.Is(err, ErrInvalidEmail) {
			t.Errorf("got %v, want ErrInvalidEmail", err)
		}
	})
}
