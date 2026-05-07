// Package oidc verifies OpenID Connect ID tokens issued by Apple and Google.
//
// We do not pull in a third-party JWKS library — the implementation here is
// ~150 lines, predictable, and only handles the RS256 case both providers
// use. If we ever add Microsoft, Facebook, or another provider with a
// different signing algorithm, this is the right place to extend.
package oidc

import (
	"context"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Provider is one of the supported OIDC issuers.
type Provider string

const (
	ProviderApple  Provider = "apple"
	ProviderGoogle Provider = "google"
)

// Claims is the verified subset of an ID token we expose to callers.
// We intentionally keep it small — anything else is the consumer's problem.
type Claims struct {
	Provider      Provider
	Subject       string // stable user id at the provider
	Email         string // may be empty (Apple after first sign-in) or a relay address
	EmailVerified bool   // Google sets this; Apple does too via private claim
	Audience      string // matched audience (one of the allowed list)
}

// AppleConfig holds the audiences and JWKS URL for Apple verification.
// In production the JWKS URL is constant; tests inject a fake URL.
type AppleConfig struct {
	BundleID string // single audience: e.g. "tech.mevatech.neuronot"
	JWKSURL  string // default: https://appleid.apple.com/auth/keys
}

// GoogleConfig holds the audiences and JWKS URL for Google verification.
// Audiences is the list of OAuth client IDs we accept (iOS, Android, Expo).
type GoogleConfig struct {
	Audiences []string
	JWKSURL   string // default: https://www.googleapis.com/oauth2/v3/certs
}

// Verifier verifies ID tokens. It is safe for concurrent use.
type Verifier struct {
	apple  *providerVerifier
	google *providerVerifier
	httpc  *http.Client
}

// NewVerifier wires both Apple and Google verifiers. Either config can be
// nil to disable that provider (verify will return ErrProviderDisabled).
func NewVerifier(apple *AppleConfig, google *GoogleConfig) *Verifier {
	v := &Verifier{
		httpc: &http.Client{Timeout: 10 * time.Second},
	}
	if apple != nil {
		url := apple.JWKSURL
		if url == "" {
			url = "https://appleid.apple.com/auth/keys"
		}
		v.apple = &providerVerifier{
			provider:  ProviderApple,
			jwksURL:   url,
			audiences: []string{apple.BundleID},
			issuers:   []string{"https://appleid.apple.com"},
			cacheTTL:  24 * time.Hour,
		}
	}
	if google != nil {
		url := google.JWKSURL
		if url == "" {
			url = "https://www.googleapis.com/oauth2/v3/certs"
		}
		v.google = &providerVerifier{
			provider:  ProviderGoogle,
			jwksURL:   url,
			audiences: append([]string(nil), google.Audiences...),
			issuers:   []string{"https://accounts.google.com", "accounts.google.com"},
			cacheTTL:  1 * time.Hour,
		}
	}
	return v
}

// Sentinel errors callers can switch on.
var (
	ErrProviderDisabled  = errors.New("oidc provider not configured")
	ErrInvalidToken      = errors.New("oidc invalid token")
	ErrInvalidAudience   = errors.New("oidc invalid audience")
	ErrInvalidIssuer     = errors.New("oidc invalid issuer")
	ErrInvalidNonce      = errors.New("oidc nonce mismatch")
	ErrEmailUnverified   = errors.New("oidc email not verified")
	ErrJWKSUnavailable   = errors.New("oidc jwks fetch failed")
	ErrUnsupportedAlg    = errors.New("oidc only RS256 is supported")
	ErrKeyNotFound       = errors.New("oidc signing key not found in jwks")
)

// VerifyApple checks an Apple identity token. The rawNonce, if non-empty, is
// hashed (SHA256) and compared against the `nonce` claim.
func (v *Verifier) VerifyApple(ctx context.Context, idToken, rawNonce string) (*Claims, error) {
	if v.apple == nil {
		return nil, ErrProviderDisabled
	}
	c, err := v.apple.verify(ctx, v.httpc, idToken)
	if err != nil {
		return nil, err
	}
	if rawNonce != "" {
		want := hashNonce(rawNonce)
		if c.nonce == "" || c.nonce != want {
			return nil, ErrInvalidNonce
		}
	}
	return claimsFromInternal(ProviderApple, c, v.apple.audiences[0]), nil
}

// VerifyGoogle checks a Google ID token. Google does not issue nonces from
// silent flows so we don't enforce one (we'd accept it in the claim if
// present, but it's optional).
func (v *Verifier) VerifyGoogle(ctx context.Context, idToken string) (*Claims, error) {
	if v.google == nil {
		return nil, ErrProviderDisabled
	}
	c, err := v.google.verify(ctx, v.httpc, idToken)
	if err != nil {
		return nil, err
	}
	if !c.emailVerified {
		return nil, ErrEmailUnverified
	}
	return claimsFromInternal(ProviderGoogle, c, c.audMatched), nil
}

// internalClaims captures everything we read off a verified token.
type internalClaims struct {
	sub           string
	email         string
	emailVerified bool
	audMatched    string
	nonce         string
}

func claimsFromInternal(p Provider, c *internalClaims, aud string) *Claims {
	return &Claims{
		Provider:      p,
		Subject:       c.sub,
		Email:         c.email,
		EmailVerified: c.emailVerified,
		Audience:      aud,
	}
}

func hashNonce(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// providerVerifier holds the per-provider JWKS cache and verification rules.
type providerVerifier struct {
	provider  Provider
	jwksURL   string
	audiences []string
	issuers   []string
	cacheTTL  time.Duration

	mu        sync.Mutex
	cachedAt  time.Time
	cachedKey map[string]*rsa.PublicKey // kid → key
}

func (pv *providerVerifier) verify(ctx context.Context, httpc *http.Client, idToken string) (*internalClaims, error) {
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	tok, parts, err := parser.ParseUnverified(idToken, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("%w: parse: %v", ErrInvalidToken, err)
	}
	if tok.Method.Alg() != "RS256" {
		return nil, ErrUnsupportedAlg
	}
	kid, _ := tok.Header["kid"].(string)
	if kid == "" {
		return nil, fmt.Errorf("%w: missing kid", ErrInvalidToken)
	}

	key, err := pv.keyFor(ctx, httpc, kid, false)
	if err != nil {
		return nil, err
	}

	// Reconstruct signing input and verify the signature against the key we
	// just fetched. We don't use jwt.Parse with a Keyfunc because we want
	// explicit control over the JWKS retry/refresh path.
	signingInput := parts[0] + "." + parts[1]
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("%w: signature decode: %v", ErrInvalidToken, err)
	}
	if err := tok.Method.Verify(signingInput, sig, key); err != nil {
		// The token might have been signed by a freshly rotated key not in
		// our cache yet — refresh once and retry.
		key, kerr := pv.keyFor(ctx, httpc, kid, true)
		if kerr != nil {
			return nil, kerr
		}
		if err := tok.Method.Verify(signingInput, sig, key); err != nil {
			return nil, fmt.Errorf("%w: signature: %v", ErrInvalidToken, err)
		}
	}

	mc, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("%w: claims type", ErrInvalidToken)
	}

	now := time.Now()
	expF, _ := mc["exp"].(float64)
	if expF == 0 || time.Unix(int64(expF), 0).Before(now) {
		return nil, fmt.Errorf("%w: expired", ErrInvalidToken)
	}
	iatF, _ := mc["iat"].(float64)
	if iatF != 0 {
		issued := time.Unix(int64(iatF), 0)
		if issued.After(now.Add(60 * time.Second)) {
			return nil, fmt.Errorf("%w: iat in the future", ErrInvalidToken)
		}
	}

	iss, _ := mc["iss"].(string)
	if !contains(pv.issuers, iss) {
		return nil, fmt.Errorf("%w: %s", ErrInvalidIssuer, iss)
	}
	matched, ok := matchAudience(mc["aud"], pv.audiences)
	if !ok {
		return nil, ErrInvalidAudience
	}

	sub, _ := mc["sub"].(string)
	if sub == "" {
		return nil, fmt.Errorf("%w: missing sub", ErrInvalidToken)
	}

	email, _ := mc["email"].(string)
	emailVerified := false
	switch ev := mc["email_verified"].(type) {
	case bool:
		emailVerified = ev
	case string:
		emailVerified = ev == "true"
	}
	nonce, _ := mc["nonce"].(string)

	return &internalClaims{
		sub:           sub,
		email:         email,
		emailVerified: emailVerified,
		audMatched:    matched,
		nonce:         nonce,
	}, nil
}

// keyFor returns an *rsa.PublicKey for the kid, fetching JWKS if missing or
// stale. forceRefresh bypasses the TTL when an unknown kid arrives.
func (pv *providerVerifier) keyFor(ctx context.Context, httpc *http.Client, kid string, forceRefresh bool) (*rsa.PublicKey, error) {
	pv.mu.Lock()
	stale := forceRefresh ||
		pv.cachedKey == nil ||
		time.Since(pv.cachedAt) > pv.cacheTTL
	if !stale {
		if k, ok := pv.cachedKey[kid]; ok {
			pv.mu.Unlock()
			return k, nil
		}
		// Unknown kid → likely rotated. Refresh.
		stale = true
	}
	pv.mu.Unlock()

	keys, err := fetchJWKS(ctx, httpc, pv.jwksURL)
	if err != nil {
		// Fall back to stale cache only if we have one — better than 503'ing
		// every login during a transient JWKS outage.
		pv.mu.Lock()
		k, ok := pv.cachedKey[kid]
		pv.mu.Unlock()
		if ok && !forceRefresh {
			return k, nil
		}
		return nil, err
	}

	pv.mu.Lock()
	pv.cachedKey = keys
	pv.cachedAt = time.Now()
	pv.mu.Unlock()

	if k, ok := keys[kid]; ok {
		return k, nil
	}
	return nil, ErrKeyNotFound
}

// jwksResponse mirrors the JWK Set wire format.
type jwksResponse struct {
	Keys []struct {
		Kid string `json:"kid"`
		Kty string `json:"kty"`
		Alg string `json:"alg"`
		Use string `json:"use"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func fetchJWKS(ctx context.Context, httpc *http.Client, url string) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}
	resp, err := httpc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d", ErrJWKSUnavailable, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}
	var jw jwksResponse
	if err := json.Unmarshal(body, &jw); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}
	out := make(map[string]*rsa.PublicKey, len(jw.Keys))
	for _, k := range jw.Keys {
		if k.Kty != "RSA" {
			continue
		}
		if k.Alg != "" && k.Alg != "RS256" {
			continue
		}
		nb, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eb, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		e := 0
		for _, b := range eb {
			e = e<<8 | int(b)
		}
		if e == 0 {
			continue
		}
		out[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nb), E: e}
	}
	return out, nil
}

func contains(haystack []string, needle string) bool {
	for _, h := range haystack {
		if h == needle {
			return true
		}
	}
	return false
}

// matchAudience returns the first allowed audience that appears in the
// token's aud claim. The claim may be a string or []string.
func matchAudience(claim any, allowed []string) (string, bool) {
	switch v := claim.(type) {
	case string:
		if contains(allowed, v) {
			return v, true
		}
	case []any:
		for _, raw := range v {
			s, _ := raw.(string)
			if contains(allowed, s) {
				return s, true
			}
		}
	}
	return "", false
}
