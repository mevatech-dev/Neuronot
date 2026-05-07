// Package aesgcm wraps Go's crypto/aes + crypto/cipher to provide an AES-256
// GCM helper for encrypting short audit-log fields (e.g. IP addresses, device
// identifiers) on the consents table. Each encryption uses a freshly random
// 12-byte nonce, and the output is laid out as nonce || ciphertext || tag.
// The 32-byte key (CONSENT_KEK) is loaded once at process boot.

// api/internal/crypto/aesgcm/aesgcm.go
package aesgcm

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
)

const (
	keyLen   = 32 // AES-256
	nonceLen = 12 // GCM standard
)

// Encrypt returns nonce(12) || ciphertext || tag(16). Each call uses a fresh
// random nonce, so two encryptions of the same plaintext produce different
// ciphertext.
func Encrypt(key, plaintext []byte) ([]byte, error) {
	if len(key) != keyLen {
		return nil, errors.New("aesgcm: key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, nonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	// gcm.Seal appends ciphertext+tag to dst. Use nonce as dst so the
	// returned slice is nonce || ciphertext || tag.
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// Decrypt accepts a buffer in the layout nonce(12) || ciphertext || tag(16)
// produced by Encrypt and returns the plaintext. The GCM authentication tag
// is verified by gcm.Open; tampering returns a non-nil error and never the
// partial plaintext.
func Decrypt(key, ciphertext []byte) ([]byte, error) {
	if len(key) != keyLen {
		return nil, errors.New("aesgcm: key must be 32 bytes")
	}
	if len(ciphertext) < nonceLen {
		return nil, errors.New("aesgcm: ciphertext too short")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce, ct := ciphertext[:nonceLen], ciphertext[nonceLen:]
	if len(ct) < gcm.Overhead() {
		return nil, errors.New("aesgcm: ciphertext too short")
	}
	return gcm.Open(nil, nonce, ct, nil)
}
