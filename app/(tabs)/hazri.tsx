import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
import { ProjectSwitcher } from '@components/ProjectSwitcher';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { StepperInput } from '@components/StepperInput';
import { useQuery } from '@/db/live';
import { markAttendance, type HazriEntry } from '@/features/actions';
import { useProject } from '@/features/project';
import { attendanceBetween, attendanceOn, settings, siteWorkers, weekLocked } from '@/features/queries';
import type { AttendanceStatus } from '@/features/types';
import { useSave } from '@/features/useSave';
import { useT } from '@/i18n';
import { addDays, shortDate, todayPK, weekDayShort, weekOf, type WeekDay } from '@/lib/dates';

const STATUSES: AttendanceStatus[] = ['FULL', 'HALF', 'ABSENT'];
const KEY: Record<AttendanceStatus, 'hazri.full' | 'hazri.half' | 'hazri.absent'> = { FULL: 'hazri.full', HALF: 'hazri.half', ABSENT: 'hazri.absent' };
const ON: Record<AttendanceStatus, string> = { FULL: 'bg-success border-success', HALF: 'bg-accent border-accent', ABSENT: 'bg-danger border-danger' };
const MARK: Record<AttendanceStatus, string> = { FULL: '✓', HALF: '½', ABSENT: '✗' };

type Draft = Record<string, { status: AttendanceStatus; ot: number }>;

export default function HazriScreen() {
  const t = useT();
  const save = useSave();
  const { projectId } = useProject();
  const today = todayPK();
  const [day, setDay] = useState(today);
  const [mode, setMode] = useState<'day' | 'week'>('day');
  // Edits belong to one site + day; another day starts from what is already marked.
  const [edits, setEdits] = useState<{ key: string; draft: Draft; saved: boolean }>({ key: '', draft: {}, saved: false });

  const data = useQuery(
    (db) => {
      if (!projectId) return null;
      const s = settings(db);
      const week = weekOf(day, s.settlementWeekStart as WeekDay);
      return {
        workers: siteWorkers(db, projectId),
        marks: attendanceOn(db, projectId, day),
        week,
        weekMarks: attendanceBetween(db, projectId, week.weekStart, week.weekEnd),
        locked: weekLocked(db, projectId, day),
      };
    },
    [projectId, day],
  );

  const key = `${projectId}:${day}`;
  const base = useMemo(() => {
    const next: Draft = {};
    for (const m of data?.marks ?? []) next[m.workerId] = { status: m.status, ot: m.overtimeHours ?? 0 };
    return next;
  }, [data?.marks]);
  const draft = edits.key === key ? edits.draft : base;
  const saved = edits.key === key && edits.saved;

  const changed = useMemo(() => {
    if (!data) return [];
    return data.workers
      .map(({ worker }) => worker.id)
      .filter((id) => {
        const d = draft[id];
        const m = data.marks.find((x) => x.workerId === id);
        return d && (!m || m.status !== d.status || (m.overtimeHours ?? 0) !== d.ot);
      });
  }, [draft, data]);

  const header = <Header title={t('hazri.title')} right={<ProjectSwitcher />} />;
  if (!projectId || !data) {
    return (
      <Screen header={header}>
        <EmptyState icon="🏗️" title={t('aaj.noSite')} />
      </Screen>
    );
  }

  const set = (workerId: string, patch: Partial<{ status: AttendanceStatus; ot: number }>) =>
    setEdits({ key, saved: false, draft: { ...draft, [workerId]: { status: draft[workerId]?.status ?? 'FULL', ot: draft[workerId]?.ot ?? 0, ...patch } } });

  const submit = () => {
    const entries: HazriEntry[] = changed.map((id) => ({ workerId: id, status: draft[id]!.status, ...(draft[id]!.ot ? { overtimeHours: draft[id]!.ot } : {}) }));
    if (!entries.length) return;
    save((db, c) => markAttendance(db, c, { projectId, date: day, entries }));
    setEdits({ key, draft, saved: true });
  };

  const top = (
    <View className="gap-3 p-4">
      <View className="flex-row gap-2">
        {(['day', 'week'] as const).map((m) => (
          <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => setMode(m)} className={`min-h-12 flex-1 items-center justify-center rounded-card border ${mode === m ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}>
            <Text className={`font-semibold ${mode === m ? 'text-primary' : 'text-muted'}`}>{t(m === 'day' ? 'hazri.day' : 'hazri.week')}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row items-center justify-between rounded-card border border-border bg-card px-1">
        <Pressable accessibilityRole="button" accessibilityLabel="Previous day" disabled={day <= addDays(today, -6)} onPress={() => setDay(addDays(day, mode === 'week' ? -7 : -1))} className="h-12 w-12 items-center justify-center">
          <Text className="text-2xl text-ink">‹</Text>
        </Pressable>
        <Text className="font-semibold text-base text-ink">{mode === 'day' ? `${weekDayShort(day)} ${shortDate(day)}${day === today ? ` · ${t('common.today')}` : ''}` : `${shortDate(data.week.weekStart)} – ${shortDate(data.week.weekEnd)}`}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next day" disabled={day >= today} onPress={() => setDay(addDays(day, mode === 'week' ? 7 : 1) > today ? today : addDays(day, mode === 'week' ? 7 : 1))} className="h-12 w-12 items-center justify-center">
          <Text className={`text-2xl ${day >= today ? 'text-neutral' : 'text-ink'}`}>›</Text>
        </Pressable>
      </View>
      {data.locked ? <StatusChip tone="warning" icon="🔒" label={t('hazri.locked')} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        <BigButton small variant="secondary" icon="➕" label={t('hazri.addWorker')} onPress={() => router.push('/hazri/worker-new')} />
        <BigButton small variant="secondary" icon="🤝" label={t('hazri.peshgi')} onPress={() => router.push('/hazri/peshgi')} />
        <BigButton small variant="secondary" icon="📏" label={t('hazri.measurement')} onPress={() => router.push('/hazri/measurement')} />
        <BigButton small variant="secondary" icon="🗓️" label={t('hazri.settlement')} onPress={() => router.push('/hazri/settlement')} />
      </ScrollView>
      {mode === 'day' && data.workers.length > 0 && !data.locked ? (
        <BigButton
          testID="all-present"
          variant="secondary"
          icon="✅"
          label={t('hazri.allPresent')}
          onPress={() => setEdits({ key, saved: false, draft: Object.fromEntries(data.workers.map(({ worker }) => [worker.id, { status: draft[worker.id]?.status ?? 'FULL', ot: draft[worker.id]?.ot ?? 0 }])) })}
        />
      ) : null}
    </View>
  );

  if (mode === 'week') {
    const days = data.week.days;
    return (
      <Screen header={header} scroll={false}>
        <FlashList
          data={data.workers}
          keyExtractor={(w) => w.worker.id}
          ListHeaderComponent={
            <>
              {top}
              <View className="flex-row px-4 pb-1">
                <View className="flex-1" />
                {days.map((d) => (
                  <Text key={d} className="w-9 text-center text-xs text-muted">
                    {weekDayShort(d).slice(0, 2)}
                  </Text>
                ))}
                <Text className="w-10 text-center text-xs text-muted">{t('hazri.days')}</Text>
              </View>
            </>
          }
          ListEmptyComponent={<View className="px-4"><EmptyState icon="👷" title={t('hazri.noWorkers')} /></View>}
          renderItem={({ item }) => {
            const marks = data.weekMarks.filter((m) => m.workerId === item.worker.id);
            const total = marks.reduce((s, m) => s + (m.status === 'FULL' ? 1 : m.status === 'HALF' ? 0.5 : 0), 0);
            return (
              <View className="mx-4 mb-2 min-h-12 flex-row items-center rounded-card border border-border bg-card px-3">
                <Text className="flex-1 font-medium text-ink" numberOfLines={1}>
                  {item.worker.name}
                </Text>
                {days.map((d) => {
                  const m = marks.find((x) => x.date === d);
                  return (
                    <Text key={d} className={`w-9 text-center font-semibold ${m ? (m.status === 'FULL' ? 'text-success' : m.status === 'HALF' ? 'text-warning' : 'text-danger') : 'text-neutral'}`}>
                      {m ? MARK[m.status] : '·'}
                    </Text>
                  );
                })}
                <Text className="w-10 text-center font-bold text-ink">{total}</Text>
              </View>
            );
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      scroll={false}
      footer={
        data.workers.length && !data.locked ? (
          <BigButton testID="save-hazri" icon={saved ? '✓' : '💾'} label={saved ? t('hazri.saved') : `${t('hazri.save')}${changed.length ? ` (${changed.length})` : ''}`} disabled={!changed.length} onPress={submit} />
        ) : undefined
      }
    >
      <FlashList
        data={data.workers}
        keyExtractor={(w) => w.worker.id}
        extraData={draft}
        ListHeaderComponent={top}
        ListEmptyComponent={
          <View className="px-4">
            <EmptyState icon="👷" title={t('hazri.noWorkers')} action={{ label: t('hazri.addWorker'), onPress: () => router.push('/hazri/worker-new') }} />
          </View>
        }
        renderItem={({ item }) => {
          const d = draft[item.worker.id];
          const mark = data.marks.find((m) => m.workerId === item.worker.id);
          return (
            <View testID={`worker-${item.worker.name}`} className="mx-4 mb-2 gap-2 rounded-card border border-border bg-card p-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-semibold text-base text-ink">{item.worker.name}</Text>
                  <Text className="text-xs text-muted">
                    {t(`wtype.${item.worker.type}` as never)}
                    {mark?.pendingSync ? ` · ⏳ ${t('kharcha.notSynced')}` : ''}
                  </Text>
                </View>
                {!d ? <StatusChip label={t('hazri.notMarked')} /> : null}
              </View>
              <View className="flex-row gap-2">
                {STATUSES.map((s) => (
                  <Pressable
                    key={s}
                    testID={`mark-${item.worker.name}-${s}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: d?.status === s, disabled: data.locked }}
                    disabled={data.locked}
                    onPress={() => set(item.worker.id, { status: s })}
                    className={`min-h-12 flex-1 items-center justify-center rounded-card border ${d?.status === s ? ON[s] : 'border-border bg-bg'}`}
                  >
                    <Text className={`font-semibold ${d?.status === s ? 'text-white' : 'text-ink'}`}>{t(KEY[s])}</Text>
                  </Pressable>
                ))}
              </View>
              {d && d.status !== 'ABSENT' ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">{t('hazri.ot')}</Text>
                  <StepperInput label={t('hazri.ot')} value={d.ot} step={0.5} max={12} onChange={(v) => set(item.worker.id, { ot: v })} />
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}
