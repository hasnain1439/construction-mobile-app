import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { ListItem } from '@components/ListItem';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { getDb } from '@/db/client';
import { useQuery } from '@/db/live';
import { listRows } from '@/db/store';
import { drawingsByFolder } from '@/features/closeout';
import { cachedDrawing, pruneDrawingCache } from '@/features/drawingCache';
import { useProject } from '@/features/project';
import type { DrawingFolder, DrawingRow } from '@/features/types';
import { useI18n, type TKey } from '@/i18n';

type Entry = { kind: 'folder'; folder: DrawingFolder; count: number } | { kind: 'drawing'; d: DrawingRow; saved: boolean };

const DrawingItem = memo(function DrawingItem({ d, saved, onPress }: { d: DrawingRow; saved: boolean; onPress: (id: string) => void }) {
  const { t, f } = useI18n();
  return (
    <View className="px-4 pb-2">
      <ListItem
        testID={`drawing-${d.id}`}
        icon="file-document-outline"
        iconTone="info"
        title={[d.number, d.title].filter(Boolean).join(' · ')}
        subtitle={[d.latestRevisionNo !== null ? t('dwg.rev', { n: d.latestRevisionNo }) : null, d.latestApprovedAt ? t('dwg.approved', { date: f.shortDate(d.latestApprovedAt) }) : t('dwg.notApproved')].filter(Boolean).join(' · ')}
        right={<StatusChip tone={saved ? 'success' : 'neutral'} icon={saved ? 'cellphone-check' : 'cloud-download-outline'} label={saved ? t('dwg.saved') : t('dwg.notSaved')} />}
        onPress={() => onPress(d.id)}
      />
    </View>
  );
});

/** Latest drawing revisions of the site by folder; a saved one opens without internet. */
export default function DrawingsScreen() {
  const { t } = useI18n();
  const { projectId, project } = useProject();
  const entries = useQuery((db): Entry[] => {
    if (!projectId) return [];
    return drawingsByFolder(db, projectId).flatMap((g) => [{ kind: 'folder' as const, folder: g.folder, count: g.items.length }, ...g.items.map((d) => ({ kind: 'drawing' as const, d, saved: !!cachedDrawing(db, d.latestAttachmentId) }))]);
  }, [projectId]);
  const latestIds = useMemo(() => entries.flatMap((e) => (e.kind === 'drawing' && e.d.latestAttachmentId ? [e.d.latestAttachmentId] : [])), [entries]);

  // A superseded revision's file leaves the phone (every site's latest files stay).
  useEffect(() => {
    const db = getDb();
    const all = listRows<DrawingRow>(db, 'drawings').flatMap((d) => (d.latestAttachmentId ? [d.latestAttachmentId] : []));
    pruneDrawingCache(db, all);
  }, [latestIds]);

  const open = useCallback((id: string) => router.push({ pathname: '/site/drawing', params: { id } }), []);
  return (
    <Screen header={<Header back title={t('dwg.title')} subtitle={project?.name} />} scroll={false}>
      <FlashList
        data={entries}
        keyExtractor={(e) => (e.kind === 'folder' ? `f:${e.folder}` : e.d.id)}
        getItemType={(e) => e.kind}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        ListEmptyComponent={
          <View className="px-4">
            <EmptyState icon="file-document-outline" title={t('dwg.empty')} />
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'folder' ? (
            <Text className="px-4 pb-2 pt-3 font-bold text-base text-ink">{`${t(`folder.${item.folder}` as TKey)} (${item.count})`}</Text>
          ) : (
            <DrawingItem d={item.d} saved={item.saved} onPress={open} />
          )
        }
      />
    </Screen>
  );
}
