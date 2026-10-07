import { Text } from 'react-native';
import { useT } from '@/i18n';
import { BigButton } from './BigButton';
import { BottomSheet } from './BottomSheet';

interface Props {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({ visible, title, body, confirmLabel, danger, loading, onConfirm, onClose }: Props) {
  const t = useT();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      {body ? <Text className="text-base text-ink">{body}</Text> : null}
      <BigButton testID="confirm-yes" label={confirmLabel ?? t('common.confirm')} variant={danger ? 'danger' : 'primary'} loading={loading} onPress={onConfirm} />
      <BigButton label={t('common.cancel')} variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}
