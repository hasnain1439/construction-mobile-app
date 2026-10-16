import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { ApiError, NetworkError, request } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getDb } from '@/db/client';
import { notifyChange, useQuery } from '@/db/live';
import { getRow } from '@/db/store';
import { cachedDrawing, downloadDrawing, isImage } from '@/features/drawingCache';
import type { DrawingRow } from '@/features/types';
import { errorText, useI18n, type TKey } from '@/i18n';
import { CARD_SHADOW, COLORS } from '@/lib/theme';

type Phase = 'idle' | 'loading' | 'offline' | 'error';

/**
 * The latest revision of a drawing. Not on the phone yet → downloaded once (online) and kept for
 * offline use. Pictures (JPG / PNG / WebP) show here; a PDF opens in the phone's viewer.
 */
export default function DrawingScreen() {
  const { t, f, language } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useQuery((db) => getRow<DrawingRow>(db, 'drawings', id), [id]);
  const attachmentId = d?.latestAttachmentId ?? null;
  const file = useQuery((db) => cachedDrawing(db, attachmentId), [attachmentId]);
  const tried = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [code, setCode] = useState<string | null>(null);

  const fetchFile = useCallback(async () => {
    if (!attachmentId) return;
    setPhase('loading');
    try {
      await downloadDrawing(getDb(), attachmentId);
      notifyChange();
      setPhase('idle');
    } catch (err) {
      setCode(err instanceof ApiError ? err.code : null);
      setPhase(err instanceof NetworkError ? 'offline' : 'error');
    }
  }, [attachmentId]);

  // Not on the phone yet: fetch it once when the screen opens (online).
  useEffect(() => {
    if (file || !attachmentId || tried.current === attachmentId) return;
    tried.current = attachmentId;
    void fetchFile();
  }, [attachmentId, file, fetchFile]);

  /** A PDF: a fresh signed link when online, else the saved file (works where the phone can open local files). */
  const openExternal = async () => {
    if (!attachmentId) return;
    try {
      const a = await request<{ url: string }>(`${ENDPOINTS.attachments}/${attachmentId}`);
      await Linking.openURL(a.url);
    } catch {
      try {
        if (!file) throw new Error('no file');
        await Linking.openURL(file.uri);
      } catch {
        Alert.alert(t('dwg.cantOpen'));
      }
    }
  };

  if (!d) {
    return (
      <Screen header={<Header back title={t('dwg.title')} />} refresh={false}>
        <EmptyState icon="file-document-outline" title={t('dwg.empty')} />
      </Screen>
    );
  }

  return (
    <Screen header={<Header back title={[d.number, d.title].filter(Boolean).join(' · ')} subtitle={t(`folder.${d.folder}` as TKey)} />} refresh={false} scroll={false}>
      <View className="gap-2 p-4">
        <View className="flex-row flex-wrap gap-2">
          {d.latestRevisionNo !== null ? <StatusChip tone="primary" label={t('dwg.rev', { n: d.latestRevisionNo })} /> : null}
          <StatusChip tone={d.latestApprovedAt ? 'success' : 'warning'} label={d.latestApprovedAt ? t('dwg.approved', { date: f.shortDate(d.latestApprovedAt) }) : t('dwg.notApproved')} />
          {d.revisionCount > 1 ? <StatusChip label={t('dwg.revisions', { n: d.revisionCount })} /> : null}
          {file ? <StatusChip tone="success" icon="cellphone-check" label={t('dwg.saved')} /> : null}
        </View>
        {phase === 'loading' ? <ActivityIndicator color={COLORS.primary} /> : null}
        {phase === 'offline' ? <Text className="text-sm text-warning">{t('dwg.offline')}</Text> : null}
        {phase === 'error' ? <Text className="text-sm text-danger">{errorText(language, code)}</Text> : null}
        {!file && phase !== 'loading' && attachmentId ? <BigButton small variant="secondary" icon="cloud-download-outline" label={t('dwg.download')} onPress={() => void fetchFile()} /> : null}
        {file && !isImage(file.mimeType) ? <BigButton testID="open-file" icon="file-pdf-box" label={t('dwg.openFile')} onPress={() => void openExternal()} /> : null}
      </View>
      {file && isImage(file.mimeType) ? (
        <ScrollView className="flex-1" contentContainerClassName="p-4" maximumZoomScale={5} minimumZoomScale={1} bouncesZoom centerContent>
          <View className="overflow-hidden rounded-card bg-card" style={CARD_SHADOW}>
            <Image source={{ uri: file.uri }} accessibilityLabel={d.title} resizeMode="contain" style={{ width: '100%', aspectRatio: 0.75 }} />
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  );
}
