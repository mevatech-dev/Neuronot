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
	return gcm.Open(nil, nonce, ct, nil)
}
