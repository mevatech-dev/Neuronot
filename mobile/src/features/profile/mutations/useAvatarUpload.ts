import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  patchProfile,
  requestAvatarUpload,
  type ProfileResponse,
} from '@/services/api/profile';
import { scheduleCycleForCurrentUser } from '@/services/sync/engine';

type UploadInput = {
  uri: string;
  contentType: 'image/jpeg' | 'image/png';
};

type Hooks = {
  onSuccess?: (data: ProfileResponse) => void;
  onError?: (err: unknown) => void;
};

// Three-step round-trip: ask the API for a pre-signed PUT, push raw bytes
// to R2, then PATCH /v1/profile with the returned key so subsequent reads
// resolve a fresh GET URL. fetch() is intentional — axios would inject
// headers that break R2's signature.
export function useAvatarUpload(hooks: Hooks = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ uri, contentType }: UploadInput) => {
      const presigned = await requestAvatarUpload(contentType);

      const fileResp = await fetch(uri);
      const blob = await fileResp.blob();
      const putResp = await fetch(presigned.upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType },
      });
      if (!putResp.ok) {
        throw new Error(`avatar upload failed: ${putResp.status}`);
      }

      return patchProfile({ avatar_key: presigned.key });
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      scheduleCycleForCurrentUser();
      hooks.onSuccess?.(data);
    },
    onError: hooks.onError,
  });
}
