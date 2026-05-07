// api/internal/crypto/aesgcm/aesgcm_test.go
package aesgcm

import (
	"bytes"
	"crypto/rand"
	"testing"
)

func newKey(t *testing.T) []byte {
	t.Helper()
	k := make([]byte, 32)
	if _, err := rand.Read(k); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return k
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := newKey(t)
	plaintext := []byte("203.0.113.42")
	ct, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if bytes.Equal(ct, plaintext) {
		t.Fatal("ciphertext equals plaintext")
	}
	got, err := Decrypt(key, ct)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Fatalf("got %q, want %q", got, plaintext)
	}
}

func TestEncryptProducesDifferentCiphertextForSamePlaintext(t *testing.T) {
	key := newKey(t)
	pt := []byte("203.0.113.42")
	a, err := Encrypt(key, pt)
	if err != nil {
		t.Fatalf("encrypt a: %v", err)
	}
	b, err := Encrypt(key, pt)
	if err != nil {
		t.Fatalf("encrypt b: %v", err)
	}
	if bytes.Equal(a, b) {
		t.Fatal("two encryptions of same plaintext produced identical ciphertext (nonce reuse?)")
	}
}

func TestDecryptRejectsTamperedCiphertext(t *testing.T) {
	key := newKey(t)
	ct, err := Encrypt(key, []byte("hello"))
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	ct[len(ct)-1] ^= 0x01
	if _, err := Decrypt(key, ct); err == nil {
		t.Fatal("decrypt of tampered ciphertext should fail")
	}
}

func TestRejectsShortKey(t *testing.T) {
	if _, err := Encrypt(make([]byte, 16), []byte("x")); err == nil {
		t.Fatal("Encrypt: expected error for short key")
	}
	// 12-byte nonce + 16-byte tag = 28-byte minimum valid ciphertext.
	dummyCT := make([]byte, 28)
	if _, err := Decrypt(make([]byte, 16), dummyCT); err == nil {
		t.Fatal("Decrypt: expected error for short key")
	}
}
