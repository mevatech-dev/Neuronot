import { useMutation } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { fetchExport } from '@/services/api/dataexport';

type ExportDataOptions = {
  onSuccess?: (uri: string) => void;
  onError?: (e: unknown) => void;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Pulls the export response and hands the user a sharable JSON file. When
// the API is configured with R2 it returns a pre-signed download URL —
// we fetch it and rewrite to a local file so Sharing can mime-type it.
// When R2 is absent (dev), the API inlines the data as `payload`.
export function useExportData(opts: ExportDataOptions = {}) {
  return useMutation({
    mutationFn: async () => {
      const resp = await fetchExport();
      const localUri = `${FileSystem.documentDirectory}neuronot-export-${todayStr()}.json`;

      if (resp.download_url) {
        const dl = await FileSystem.downloadAsync(resp.download_url, localUri);
        if (dl.status !== 200) {
          throw new Error(`download failed: ${dl.status}`);
        }
      } else if (resp.payload) {
        await FileSystem.writeAsStringAsync(localUri, JSON.stringify(resp.payload, null, 2), {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else {
        throw new Error('export response missing both download_url and payload');
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'application/json',
          dialogTitle: 'Neuronot export',
        });
      }

      return localUri;
    },
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}
