import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { getDb } from '@/db/client';
import { keepVoiceNote } from '@/features/media';
import { useT } from '@/i18n';
import { CARD_SHADOW, COLORS } from '@/lib/theme';
import { localUriOf } from '@/sync/attachments';
import { BigButton } from './BigButton';
import { Icon } from './Icon';

export const MAX_SECONDS = 30;

/** One voice note (up to 30 s, stops by itself). The value is the attachment clientId. */
export function VoiceRecorder({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const t = useT();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const uri = value ? localUriOf(getDb(), value) : null;
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  const stop = async () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
    await recorder.stop();
    if (recorder.uri) onChange(await keepVoiceNote(recorder.uri));
  };
  // The interval needs the latest `stop` (it closes over onChange).
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  });

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const start = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert(t('log.micDenied'));
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setSeconds(0);
    setRecording(true);
    const started = Date.now();
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      // Stops by itself at 30 s.
      if (s >= MAX_SECONDS) void stopRef.current();
    }, 250);
  };

  if (recording) {
    return (
      <View className="gap-3 rounded-card border border-danger/30 bg-danger-soft p-4">
        <View className="flex-row items-center gap-2">
          <Icon name="record-circle" size={20} color={COLORS.danger} />
          <Text className="flex-1 font-semibold text-danger">{t('log.recording', { s: `${seconds}/${MAX_SECONDS}` })}</Text>
        </View>
        <BigButton variant="danger" icon="⏹" label={t('log.stop')} onPress={() => void stop()} />
      </View>
    );
  }
  if (value) {
    return (
      <View className="flex-row items-center gap-2 rounded-card bg-card p-3" style={CARD_SHADOW}>
        <View className="flex-1">
          <BigButton
            small
            variant="secondary"
            icon={status.playing ? '⏸' : '▶️'}
            label={t('log.play')}
            disabled={!uri}
            onPress={() => {
              if (status.playing) player.pause();
              else {
                if (status.didJustFinish || status.currentTime >= status.duration) void player.seekTo(0);
                player.play();
              }
            }}
          />
        </View>
        <BigButton small variant="ghost" label={t('common.delete')} onPress={() => onChange(null)} />
      </View>
    );
  }
  return <BigButton variant="secondary" icon="🎙️" label={t('log.record')} onPress={() => void start()} />;
}
