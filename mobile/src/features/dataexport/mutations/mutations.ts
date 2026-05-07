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

export function useExportData(opts: ExportDataOptions = {}) {
  return useMutation({
    mutationFn: async () => {
      const payload = await fetchExport();
      const uri = `${FileSystem.documentDirectory}neuronot-export-${todayStr()}.json`;

      await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: 'Neuronot export',
        });
      }

      return uri;
    },
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}
