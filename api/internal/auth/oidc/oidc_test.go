package oidc

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// fakeJWKSServer signs tokens with a key pair we control and serves the
// matching public key at the JWKS URL — exactly like Apple/Google would.
type fakeJWKS struct {
	priv *rsa.PrivateKey
	kid  string
	srv  *httptest.Server
}

func newFakeJWKS(t *testing.T) *fakeJWKS {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	f := &fakeJWKS{priv: priv, kid: "test-kid-1"}
	mux := http.NewServeMux()
	mux.HandleFunc("/keys", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]any{
				{
					"kid": f.kid,
					"kty": "RSA",
					"alg": "RS256",
					"use": "sig",
					"n":   base64.RawURLEncoding.EncodeToString(priv.N.Bytes()),
					"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(priv.E)).Bytes()),
				},
			},
		})
	})
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeJWKS) sign(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = f.kid
	signed, err := tok.SignedString(f.priv)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

func TestVerifyApple_HappyPath(t *testing.T) {
	f := newFakeJWKS(t)
	v := NewVerifier(&AppleConfig{
		BundleID: "tech.test.bundle",
		JWKSURL:  f.srv.URL + "/keys",
	}, nil)

	rawNonce := "nonce-abc-123"
	tok := f.sign(t, jwt.MapClaims{
		"iss":            "https://appleid.apple.com",
		"aud":            "tech.test.bundle",
		"sub":            "001234.abcdef",
		"email":          "alice@privaterelay.appleid.com",
		"email_verified": "true",
		"is_private_email": "true",
		"nonce":          hashNonce(rawNonce),
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(5 * time.Minute).Unix(),
	})

	c, err := v.VerifyApple(context.Background(), tok, rawNonce)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if c.Provider != ProviderApple {
		t.Errorf("provider = %v", c.Provider)
	}
	if c.Subject != "001234.abcdef" {
		t.Errorf("subject = %q", c.Subject)
	}
	if c.Email != "alice@privaterelay.appleid.com" {
		t.Errorf("email = %q", c.Email)
	}
	if !c.EmailVerified {
		t.Errorf("email_verified should be true")
	}
}

func TestVerifyApple_NonceMismatch(t *testing.T) {
	f := newFakeJWKS(t)
	v := NewVerifier(&AppleConfig{BundleID: "x", JWKSURL: f.srv.URL + "/keys"}, nil)

	tok := f.sign(t, jwt.MapClaims{
		"iss":   "https://appleid.apple.com",
		"aud":   "x",
		"sub":   "abc",
		"nonce": hashNonce("expected-nonce"),
		"exp":   time.Now().Add(time.Minute).Unix(),
	})
	_, err := v.VerifyApple(context.Background(), tok, "wrong-nonce")
	if !errors.Is(err, ErrInvalidNonce) {
		t.Fatalf("want ErrInvalidNonce, got %v", err)
	}
}

func TestVerifyApple_WrongAudience(t *testing.T) {
	f := newFakeJWKS(t)
	v := NewVerifier(&AppleConfig{BundleID: "right", JWKSURL: f.srv.URL + "/keys"}, nil)

	tok := f.sign(t, jwt.MapClaims{
		"iss": "https://appleid.apple.com",
		"aud": "wrong",
		"sub": "abc",
		"exp": time.Now().Add(time.Minute).Unix(),
	})
	_, err := v.VerifyApple(context.Background(), tok, "")
	if !errors.Is(err, ErrInvalidAudience) {
		t.Fatalf("want ErrInvalidAudience, got %v", err)
	}
}

func TestVerifyApple_Expired(t *testing.T) {
	f := newFakeJWKS(t)
	v := NewVerifier(&AppleConfig{BundleID: "x", JWKSURL: f.srv.URL + "/keys"}, nil)

	tok := f.sign(t, jwt.MapClaims{
		"iss": "https://appleid.apple.com",
		"aud": "x",
		"sub": "abc",
		"exp": time.Now().Add(-time.Minute).Unix(),
	})
	_, err := v.VerifyApple(context.Background(), tok, "")
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("want ErrInvalidToken (expired), got %v", err)
	}
}

func TestVerifyGoogle_HappyPath(t *testing.T) {
	f := newFakeJWKS(t)
	v := NewVerifier(nil, &GoogleConfig{
		Audiences: []string{"ios-cid.apps.googleusercontent.com", "android-cid.apps.googleusercontent.com"},
		JWKSURL:   f.srv.URL + "/keys",
	})

	tok := f.sign(t, jwt.MapClaims{
		"iss":            "https://accounts.google.com",
		"aud":            "android-cid.apps.googleusercontent.com",
		"sub":            "google-1234567890",
		"email":          "bob@gmail.com",
		"email_verified": true,
		"exp":            time.Now().Add(5 * time.Minute).Unix(),
	})

	c, err := v.VerifyGoogle(context.Background(), tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if c.Provider != ProviderGoogle || c.Subject != "google-1234567890" {
		t.Errorf("unexpected claims: %+v", c)
	}
	if c.Audience != "android-cid.apps.googleusercontent.com" {
		t.Errorf("audience matched wrong: %q", c.Audience)
	}
	if !c.EmailVerified {
		t.Errorf("expected email_verified true")
	}
}

func TestVerifyGoogle_EmailUnverified(t *testing.T) {
	f := newFakeJWKS(t)
	v := NewVerifier(nil, &GoogleConfig{
		Audiences: []string{"ios"},
		JWKSURL:   f.srv.URL + "/keys",
	})

	tok := f.sign(t, jwt.MapClaims{
		"iss":            "https://accounts.google.com",
		"aud":            "ios",
		"sub":            "abc",
		"email":          "noverify@example.com",
		"email_verified": false,
		"exp":            time.Now().Add(time.Minute).Unix(),
	})
	_, err := v.VerifyGoogle(context.Background(), tok)
	if !errors.Is(err, ErrEmailUnverified) {
		t.Fatalf("want ErrEmailUnverified, got %v", err)
	}
}

func TestVerifyGoogle_AudienceList(t *testing.T) {
	// aud claim can be a list; we should accept if any entry is allowed.
	f := newFakeJWKS(t)
	v := NewVerifier(nil, &GoogleConfig{
		Audiences: []string{"web-cid"},
		JWKSURL:   f.srv.URL + "/keys",
	})

	tok := f.sign(t, jwt.MapClaims{
		"iss":            "accounts.google.com", // also accepted
		"aud":            []string{"some-other", "web-cid"},
		"sub":            "abc",
		"email_verified": true,
		"exp":            time.Now().Add(time.Minute).Unix(),
	})
	c, err := v.VerifyGoogle(context.Background(), tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if c.Audience != "web-cid" {
		t.Errorf("matched audience = %q", c.Audience)
	}
}

func TestVerifier_ProviderDisabled(t *testing.T) {
	v := NewVerifier(nil, nil)

	if _, err := v.VerifyApple(context.Background(), "x.y.z", ""); !errors.Is(err, ErrProviderDisabled) {
		t.Errorf("apple: want ErrProviderDisabled, got %v", err)
	}
	if _, err := v.VerifyGoogle(context.Background(), "x.y.z"); !errors.Is(err, ErrProviderDisabled) {
		t.Errorf("google: want ErrProviderDisabled, got %v", err)
	}
}

func TestJWKS_RefreshOnRotation(t *testing.T) {
	// Simulates a real key rotation: cache holds kid-A, then the IdP rotates
	// to kid-B. A token signed with kid-B should trigger a JWKS refresh and
	// succeed without operator intervention.
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	served := struct {
		kid string
		hit int
	}{kid: "kid-A"}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		served.hit++
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]any{{
				"kid": served.kid,
				"kty": "RSA",
				"alg": "RS256",
				"n":   base64.RawURLEncoding.EncodeToString(priv.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(priv.E)).Bytes()),
			}},
		})
	}))
	t.Cleanup(srv.Close)

	v := NewVerifier(&AppleConfig{BundleID: "x", JWKSURL: srv.URL + "/keys"}, nil)

	// Warm the cache with kid-A.
	tokA := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": "https://appleid.apple.com", "aud": "x", "sub": "alice",
		"exp": time.Now().Add(time.Minute).Unix(),
	})
	tokA.Header["kid"] = "kid-A"
	signedA, _ := tokA.SignedString(priv)
	if _, err := v.VerifyApple(context.Background(), signedA, ""); err != nil {
		t.Fatalf("warm verify: %v", err)
	}
	hitsAfterWarm := served.hit

	// Rotate.
	served.kid = "kid-B"
	tokB := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": "https://appleid.apple.com", "aud": "x", "sub": "bob",
		"exp": time.Now().Add(time.Minute).Unix(),
	})
	tokB.Header["kid"] = "kid-B"
	signedB, _ := tokB.SignedString(priv)

	c, err := v.VerifyApple(context.Background(), signedB, "")
	if err != nil {
		t.Fatalf("post-rotation verify: %v", err)
	}
	if c.Subject != "bob" {
		t.Errorf("subject = %q, want bob", c.Subject)
	}
	if served.hit <= hitsAfterWarm {
		t.Errorf("expected JWKS refetch on unknown kid, hits=%d (warm=%d)", served.hit, hitsAfterWarm)
	}
}

// Sanity: verify our nonce hash matches an offline reference to prevent
// drift if someone changes the encoding in production.
func TestHashNonce_Stable(t *testing.T) {
	got := hashNonce("hello world")
	const want = "uU0nuZNNPgilLlLX2n2r-sSE7-N6U4DukIj3rOLvzek"
	if !strings.EqualFold(got, want) {
		t.Errorf("hashNonce(\"hello world\") = %q, want %q", got, want)
	}
}
