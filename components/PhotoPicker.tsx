import { useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { getDb } from '@/db/client';
import { takePhoto } from '@/features/media';
import { useT } from '@/i18n';
import { COLORS } from '@/lib/theme';
import { localUriOf, type AttachmentKind } from '@/sync/attachments';
import { BigButton } from './BigButton';
import { Icon } from './Icon';

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  kind: AttachmentKind;
  max?: number;
  label?: string;
  required?: boolean;
}

/** Camera / gallery → resized JPEG queued for upload; the value is the attachment clientIds. */
export function PhotoPicker({ value, onChange, kind, max = 10, label, required }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const add = async (source: 'camera' | 'gallery') => {
    setBusy(true);
    try {
      const id = await takePhoto(source, kind);
      if (id) onChange([...value, id]);
    } catch (err) {
      Alert.alert(t('err.generic'), err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="gap-2">
      <Text className="font-semibold text-sm text-ink">
        {label ?? t('common.photos')} {required ? '*' : `(${t('common.optional')})`}
      </Text>
      {value.length ? (
        <View className="flex-row flex-wrap gap-2">
          {value.map((id) => {
            const uri = localUriOf(getDb(), id);
            return (
              <Pressable key={id} accessibilityLabel={t('common.delete')} onLongPress={() => onChange(value.filter((x) => x !== id))} className="h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg">
                {uri ? <Image source={{ uri }} className="h-full w-full" /> : <Icon name="image-outline" size={28} color={COLORS.neutral} />}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {value.length < max ? (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <BigButton small variant="secondary" icon="📷" label={t('common.takePhoto')} loading={busy} onPress={() => void add('camera')} />
          </View>
          <View className="flex-1">
            <BigButton small variant="secondary" icon="🖼️" label={t('common.gallery')} disabled={busy} onPress={() => void add('gallery')} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
