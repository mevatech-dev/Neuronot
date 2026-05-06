import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast, type ToastSpec, type ToastTone } from './Toast';

type ShowOptions = {
  messageKey: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ContextShape = {
  show: (opts: ShowOptions) => void;
};

const ToastContext = createContext<ContextShape | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastSpec[]>([]);

  const show = useCallback(
    (opts: ShowOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [
        ...prev,
        {
          id,
          message: t(opts.messageKey),
          tone: opts.tone ?? 'info',
          durationMs: opts.durationMs,
        },
      ]);
    },
    [t],
  );

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const value = useMemo<ContextShape>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
        }}
      >
        {items.map((spec) => (
          <Toast key={spec.id} spec={spec} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ContextShape {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
