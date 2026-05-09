import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { ApiError } from '@/services/api/client';
import { useTheme } from '@/theme';

import { useAvatarUpload } from '../mutations';

type Props = {
  avatarUrl: string | null | undefined;
  size?: number;
};

const AVATAR_DEFAULT_SIZE = 96;

export function AvatarPicker({ avatarUrl, size = AVATAR_DEFAULT_SIZE }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const toast = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);

  const upload = useAvatarUpload({
    onSuccess: () => toast.show({ messageKey: 'profile_edit.avatar_saved', tone: 'success' }),
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.profile.avatar_upload_failed';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  const busy = upload.isPending || pickerOpen;

  const pick = async () => {
    if (busy) return;
    setPickerOpen(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show({ messageKey: 'errors.profile.avatar_permission_denied', tone: 'danger' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const contentType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      upload.mutate({ uri: asset.uri, contentType });
    } finally {
      setPickerOpen(false);
    }
  };

  return (
    <View style={{ alignItems: 'center', gap: theme.space[3] }}>
      <Pressable
        onPress={pick}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('profile_edit.change_avatar')}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.surface.elevated,
          borderWidth: 2,
          borderColor: theme.colors.border.subtle,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: size, height: size }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={{ ...theme.typography.title, color: theme.colors.text.muted }}>
            {'?'}
          </Text>
        )}
        {busy && (
          <View
            style={{
              ...absFill,
              backgroundColor: theme.colors.surface.overlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LoadingDots color={theme.colors.text.primary} />
          </View>
        )}
      </Pressable>
      <Pressable onPress={pick} disabled={busy}>
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.default }}>
          {t('profile_edit.change_avatar')}
        </Text>
      </Pressable>
    </View>
  );
}

const absFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
