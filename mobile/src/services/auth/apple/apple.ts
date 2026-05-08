import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export type AppleSignInResult = {
  identityToken: string;
  rawNonce: string;
  email: string | null;
  fullName: string | null;
};

// base64url encodes Uint8Array bytes per RFC 4648 §5 (no padding). expo-
// crypto only ships BASE64 (with padding); we strip it and swap the
// alt alphabet here so both nonce generation and hashing share one path.
function bytesToBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// generateRawNonce returns a 32-byte URL-safe random string. The raw
// value travels to our server (verified against the JWT claim); the
// SHA-256 hash travels to Apple. Both sides must agree on the encoding.
async function generateRawNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return bytesToBase64Url(bytes);
}

// hashNonce mirrors the server-side oidc.hashNonce: base64url(sha256(raw)).
// Mobile passes this hash to Apple; Apple round-trips it into the
// identityToken's `nonce` claim; the server recomputes from rawNonce
// and compares.
async function hashNonce(raw: string): Promise<string> {
  const b64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return base64ToBase64Url(b64);
}

// isAvailable mirrors AppleAuthentication.isAvailableAsync(). We expose
// this synchronously where possible so the welcome screen can render or
// hide the Apple button without a flash.
export function isAppleSignInLikelyAvailable(): boolean {
  // Native availability is iOS 13+ only. On Android the button stays hidden.
  return Platform.OS === 'ios';
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (!isAppleSignInLikelyAvailable()) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithAppleNative(): Promise<AppleSignInResult | null> {
  const rawNonce = await generateRawNonce();
  const hashedNonce = await hashNonce(rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: unknown) {
    // ERR_CANCELED is the documented rejection when the user dismisses
    // the sheet. Treat as a non-error null result.
    const err = e as { code?: string };
    if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') {
      return null;
    }
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('apple: missing identity token');
  }

  const fullName =
    credential.fullName?.givenName || credential.fullName?.familyName
      ? [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean)
          .join(' ')
      : null;

  return {
    identityToken: credential.identityToken,
    rawNonce,
    email: credential.email ?? null,
    fullName,
  };
}
