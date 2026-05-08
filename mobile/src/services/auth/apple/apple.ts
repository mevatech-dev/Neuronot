import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export type AppleSignInResult = {
  identityToken: string;
  rawNonce: string;
  email: string | null;
  fullName: string | null;
};

// generateRawNonce returns a URL-safe random string. The hash of this
// nonce is what we pass to Apple; the raw value goes to our server which
// hashes and compares it against the JWT claim. This protects against
// replay attacks.
async function generateRawNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  // base64url without padding
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashNonce(raw: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  // expo-crypto returns hex; Apple wants the hashed nonce as a string and
  // server hashes raw with SHA256 → base64url. We pass hex to Apple here
  // because Apple just round-trips the value into the `nonce` claim, and
  // our server does its own SHA256(rawNonce) compare against the claim.
  // To keep both sides consistent we compare server-side as base64url(sha256(raw)).
  // So we encode the hex to bytes → base64url here.
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
