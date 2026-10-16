import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@components/EmptyState';
import { Icon } from '@components/Icon';
import { IconBadge, type BadgeTone } from '@components/IconBadge';
import { ListItem } from '@components/ListItem';
import { MilestoneCard } from '@components/MilestoneCard';
import { MoneyText } from '@components/MoneyText';
import { ProjectSwitcher } from '@components/ProjectSwitcher';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { usePermissions } from '@/features/access';
import { useProject } from '@/features/project';
import { incomingEquipment } from '@/features/equipment';
import { attendanceOn, cashAccount, incomingDispatches, incomingPurchases, materialMap, myLogOn, pendingFloats, settings, settlementFor, siteWorkers } from '@/features/queries';
import { milestones, todayMilestones } from '@/features/schedule';
import { useUser } from '@/features/session';
import { useI18n } from '@/i18n';
import { todayPK, weekOf, type WeekDay } from '@/lib/dates';
import { PERM, TAB_PERMS } from '@/lib/permissions';
import { CARD_SHADOW, COLORS, RAISED_SHADOW, TOPBAR_SHADOW } from '@/lib/theme';

/** Greeting bar (like the web top bar): avatar, name, date and the current site. */
function HomeHeader({ name, date }: { name: string; date: string }) {
  const { t } = useI18n();
  return (
    <SafeAreaView edges={['top']} className="z-10 bg-card" style={TOPBAR_SHADOW}>
      <View className="flex-row items-center gap-3 px-4 pb-4 pt-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-sand">
          <Text className="font-bold text-lg text-ink">{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-bold text-lg text-ink" numberOfLines={1}>
            {t('aaj.greeting', { name })}
          </Text>
          <Text className="text-xs text-muted">{date}</Text>
        </View>
        <ProjectSwitcher />
      </View>
    </SafeAreaView>
  );
}

/** Today: what is still to do on this site, my cash and quick actions. */
export default function AajScreen() {
  const { t, f, rtl } = useI18n();
  const user = useUser();
  const perms = usePermissions();
  const { projectId, project } = useProject();
  const today = todayPK();
  const seesPlan = perms.can(PERM.planView);
  const canReceiveEq = perms.can(PERM.equipmentReceive);
  const data = useQuery(
    (db) => {
      if (!projectId) return null;
      const acc = cashAccount(db);
      const week = weekOf(today, settings(db).settlementWeekStart as WeekDay);
      return {
        workers: siteWorkers(db, projectId).length,
        marked: attendanceOn(db, projectId, today).length,
        incoming: incomingDispatches(db, projectId).length + incomingPurchases(db, projectId).length,
        incomingEq: canReceiveEq ? incomingEquipment(db, projectId).length : 0,
        work: seesPlan ? todayMilestones(db, projectId, today) : [],
        hasSchedule: seesPlan && milestones(db, projectId).length > 0,
        mats: materialMap(db),
        floats: pendingFloats(db, acc?.id).length,
        account: acc,
        settlement: settlementFor(db, projectId, week.weekStart),
        log: myLogOn(db, projectId, user.id, today),
      };
    },
    [projectId, today, user.id, seesPlan, canReceiveEq],
  );
  const mats = data?.mats;
  const materialName = useCallback((id: string | null, fallback: string) => (id ? (mats?.get(id)?.name ?? fallback) : fallback), [mats]);
  const openMilestone = useCallback((id: string) => router.push({ pathname: '/site/milestone', params: { id } }), []);

  const header = <HomeHeader name={user.name.split(' ')[0] ?? user.name} date={f.longDate(today)} />;
  if (!project || !data) {
    return (
      <Screen header={header} safeTop={false}>
        <EmptyState icon="🏗️" title={t('aaj.noSite')} />
      </Screen>
    );
  }

  const todo: { icon: string; tone: BadgeTone; title: string; done: boolean; href: Href; testID: string }[] = [];
  if (perms.can(PERM.hazriMark)) {
    todo.push({
      icon: '👷',
      tone: 'primary',
      title: data.marked > 0 ? t('aaj.hazriDone', { n: `${data.marked}/${data.workers}` }) : t('aaj.markHazri'),
      done: data.marked > 0 && data.marked >= data.workers,
      href: '/hazri',
      testID: 'todo-hazri',
    });
  }
  if (perms.can(PERM.logCreate)) todo.push({ icon: '📝', tone: 'violet', title: data.log ? t('aaj.logDone') : t('aaj.logMissing'), done: !!data.log, href: '/log/today', testID: 'todo-log' });
  if (data.incoming && perms.can(PERM.receive)) todo.push({ icon: '🚚', tone: 'info', title: t('aaj.incoming', { n: data.incoming }), done: false, href: '/maal', testID: 'todo-incoming' });
  if (data.incomingEq) todo.push({ icon: 'crane', tone: 'violet', title: `${t('eq.incoming')} (${data.incomingEq})`, done: false, href: '/maal', testID: 'todo-incoming-eq' });
  if (data.floats && perms.can(PERM.cashView)) todo.push({ icon: '💵', tone: 'success', title: t('aaj.floats', { n: data.floats }), done: false, href: '/kharcha', testID: 'todo-floats' });
  if (data.settlement && perms.can(PERM.settlementView)) {
    todo.push({
      icon: '🗓️',
      tone: 'accent',
      title: t('aaj.settlement', { status: t(`settlement.${data.settlement.status}` as never) }),
      done: data.settlement.status === 'APPROVED',
      href: '/hazri/settlement',
      testID: 'todo-settlement',
    });
  }
  const doneCount = todo.filter((x) => x.done).length;

  const quick = (
    [
      { icon: '👷', tone: 'primary', label: t('tabs.hazri'), href: '/hazri', show: perms.canAny(...TAB_PERMS.hazri) },
      { icon: '🧱', tone: 'accent', label: t('maal.usage'), href: '/maal/usage', show: perms.can(PERM.usageCreate) },
      { icon: '💵', tone: 'success', label: t('kharcha.add'), href: '/kharcha/new', show: perms.can(PERM.expenseCreate) },
      { icon: '📝', tone: 'violet', label: t('mazeed.dailyLog'), href: '/log/today', show: perms.can(PERM.logCreate) },
      { icon: '🤝', tone: 'info', label: t('hazri.peshgi'), href: '/hazri/peshgi', show: perms.can(PERM.peshgiCreate) },
      { icon: '📦', tone: 'danger', label: t('maal.ownerDelivery'), href: '/maal/owner-delivery', show: perms.can(PERM.ownerDeliveryCreate) },
      { icon: 'weather-pouring', tone: 'warning', label: t('stop.new'), href: '/site/stoppage-new', show: perms.can(PERM.stoppageCreate) },
      { icon: 'message-draw', tone: 'info', label: t('si.new'), href: '/site/instruction-new', show: perms.can(PERM.instructionCreate) },
      { icon: 'map-marker-alert-outline', tone: 'danger', label: t('snag.new'), href: '/site/snag-new', show: perms.can(PERM.snagCreate) },
    ] satisfies { icon: string; tone: BadgeTone; label: string; href: Href; show: boolean }[]
  ).filter((q) => q.show);

  return (
    <Screen header={header} safeTop={false}>
      {data.account && perms.canAny(...TAB_PERMS.kharcha) ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/kharcha')} className="overflow-hidden rounded-card bg-sand p-5 active:opacity-95" style={RAISED_SHADOW}>
          {/* Big faint icon in the corner, like the web KPI tiles. */}
          <View className="absolute -bottom-6 -right-4 opacity-15">
            <Icon name="wallet-outline" size={120} color={COLORS.ink} />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="font-medium text-sm text-ink">{t('aaj.myCash')}</Text>
            <View className="h-9 w-9 items-center justify-center rounded-full bg-white/45">
              <Icon name="wallet-outline" size={18} color={COLORS.ink} />
            </View>
          </View>
          <MoneyText paisa={data.account.balancePaisa} className="mt-1 text-3xl !text-ink" />
          <View className="mt-3 flex-row items-center gap-1">
            <Text className="font-semibold text-xs text-ink">{t('kharcha.title')}</Text>
            <Icon name={rtl ? 'arrow-left' : 'arrow-right'} size={14} color={COLORS.ink} />
          </View>
        </Pressable>
      ) : null}

      <View className="mt-2 flex-row items-center justify-between">
        <Text className="font-bold text-lg text-ink">{t('aaj.todo')}</Text>
        <StatusChip tone={doneCount === todo.length ? 'success' : 'primary'} label={`${doneCount}/${todo.length}`} />
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-border">
        <View className="h-full rounded-full bg-success" style={{ width: `${todo.length ? (doneCount / todo.length) * 100 : 0}%` }} />
      </View>
      {todo.map((item) => (
        <ListItem
          key={item.testID}
          testID={item.testID}
          icon={item.done ? 'check-circle-outline' : item.icon}
          iconTone={item.done ? 'success' : item.tone}
          title={item.title}
          right={item.done ? <StatusChip tone="success" label="✓" /> : undefined}
          onPress={() => router.push(item.href)}
        />
      ))}

      {seesPlan ? (
        <>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="font-bold text-lg text-ink">{t('site.todayWork')}</Text>
            {data.hasSchedule ? (
              <Pressable testID="all-milestones" accessibilityRole="button" onPress={() => router.push('/site/milestones')} className="min-h-11 justify-center px-2">
                <Text className="font-semibold text-sm text-primary">{t('site.allMilestones')}</Text>
              </Pressable>
            ) : null}
          </View>
          {data.work.length ? (
            data.work.map((m) => <MilestoneCard key={m.id} m={m} today={today} materialName={materialName} onPress={openMilestone} />)
          ) : (
            <View className="rounded-card border border-dashed border-border bg-card px-4 py-3">
              <Text className="text-sm text-muted">{data.hasSchedule ? t('site.noMilestones') : t('site.noSchedule')}</Text>
            </View>
          )}
        </>
      ) : null}

      {quick.length ? <Text className="mt-3 font-bold text-lg text-ink">{t('aaj.quick')}</Text> : null}
      <View className="flex-row flex-wrap gap-3">
        {quick.map((q) => (
          <Pressable
            key={q.label}
            accessibilityRole="button"
            accessibilityLabel={q.label}
            onPress={() => router.push(q.href)}
            className="min-h-28 w-[30%] flex-grow items-center justify-center gap-2 rounded-card bg-card p-3 active:bg-bg"
            style={CARD_SHADOW}
          >
            <IconBadge name={q.icon} tone={q.tone} size={48} />
            <Text className="text-center font-semibold text-xs text-ink" numberOfLines={2}>
              {q.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
