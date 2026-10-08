import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
        <Pressable accessibilityLabel="Close" onPress={onClose} className="absolute inset-0 bg-black/40" />
        <View className="max-h-[85%] rounded-t-[28px] bg-card" style={{ paddingBottom: insets.bottom + 16 }}>
          <View className="items-center py-2">
            <View className="h-1.5 w-12 rounded-full bg-border" />
          </View>
          {title ? <Text className="px-4 pb-2 font-bold text-lg text-ink">{title}</Text> : null}
          <ScrollView contentContainerClassName="gap-3 px-4" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
