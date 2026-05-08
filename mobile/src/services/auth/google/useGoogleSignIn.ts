import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

export type GoogleSignInResult = { idToken: string };

type Extra = {
  googleClientIdIos?: string;
  googleClientIdAndroid?: string;
  googleClientIdExpo?: string;
};

function readExtra(): Extra {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  return {
    googleClientIdIos: extra.googleClientIdIos,
    googleClientIdAndroid: extra.googleClientIdAndroid,
    googleClientIdExpo: extra.googleClientIdExpo,
  };
}

// useGoogleSignIn returns a hook surface mirroring the other auth helpers:
//  - ready: true once expo-auth-session has loaded the OAuth client.
//  - signIn(): kicks off the Google web sheet; resolves with { idToken } or
//    null when the user cancels.
//  - configError: true if no Google client id is configured for this build,
//    so the welcome screen can hide the button.
export function useGoogleSignIn() {
  const extra = readExtra();
  const configured = Boolean(
    extra.googleClientIdIos || extra.googleClientIdAndroid || extra.googleClientIdExpo,
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: extra.googleClientIdIos,
    androidClientId: extra.googleClientIdAndroid,
    clientId: extra.googleClientIdExpo,
  });

  const [pending, setPending] = useState(false);
  const resolverRef = useRef<((res: GoogleSignInResult | null) => void) | null>(null);
  const rejecterRef = useRef<((err: unknown) => void) | null>(null);

  useEffect(() => {
    if (!response) return;
    const resolve = resolverRef.current;
    const reject = rejecterRef.current;
    resolverRef.current = null;
    rejecterRef.current = null;
    setPending(false);

    if (response.type === 'success') {
      const idToken = (response.params as { id_token?: string }).id_token;
      if (!idToken) {
        reject?.(new Error('google: missing id_token'));
        return;
      }
      resolve?.({ idToken });
      return;
    }
    if (response.type === 'error') {
      reject?.(response.error ?? new Error('google: auth error'));
      return;
    }
    // 'cancel' / 'dismiss' / 'locked' all map to "user backed out"
    resolve?.(null);
  }, [response]);

  const signIn = async (): Promise<GoogleSignInResult | null> => {
    if (!configured) {
      throw new Error('google: no client id configured');
    }
    if (!request) {
      throw new Error('google: auth request not ready');
    }
    setPending(true);
    return new Promise<GoogleSignInResult | null>((resolve, reject) => {
      resolverRef.current = resolve;
      rejecterRef.current = reject;
      promptAsync().catch((e) => {
        resolverRef.current = null;
        rejecterRef.current = null;
        setPending(false);
        reject(e);
      });
    });
  };

  return {
    ready: configured && Boolean(request),
    pending,
    configured,
    signIn,
  };
}
