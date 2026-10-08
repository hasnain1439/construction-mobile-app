import { router, useFocusEffect, type Href } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@components/EmptyState';
import { Icon } from '@components/Icon';
import { IconBadge, type BadgeTone } from '@components/IconBadge';
import { ListItem } from '@components/ListItem';
import { MoneyText } from '@components/MoneyText';
import { ProjectSwitcher } from '@components/ProjectSwitcher';
import { Screen } from '@components/Screen';
import { StatusChip } from '@components/StatusChip';
import { useQuery } from '@/db/live';
import { useProject } from '@/features/project';
import { attendanceOn, cashAccount, incomingDispatches, incomingPurchases, myLogOn, pendingFloats, settings, settlementFor, siteWorkers } from '@/features/queries';
import { useUser } from '@/features/session';
import { useT } from '@/i18n';
import { longDate, todayPK, weekOf, type WeekDay } from '@/lib/dates';
import { CARD_SHADOW, COLORS, RAISED_SHADOW } from '@/lib/theme';

/** Navy greeting band: name, date and the current site. */
function HomeHeader({ name, date }: { name: string; date: string }) {
  const t = useT();
  // Light status-bar icons over the navy band while this tab is in front.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );
  return (
    <SafeAreaView edges={['top']} className="bg-brand">
      <View className="flex-row items-center gap-3 px-4 pb-5 pt-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-accent">
          <Text className="font-bold text-lg text-brand">{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-bold text-lg text-white" numberOfLines={1}>
            {t('aaj.greeting', { name })}
          </Text>
          <Text className="text-xs text-brand-muted">{date}</Text>
        </View>
        <ProjectSwitcher onDark />
      </View>
    </SafeAreaView>
  );
}

/** Today: what is still to do on this site, my cash and quick actions. */
export default function AajScreen() {
  const t = useT();
  const user = useUser();
  const { projectId, project } = useProject();
  const today = todayPK();
  const data = useQuery(
    (db) => {
      if (!projectId) return null;
      const acc = cashAccount(db);
      const week = weekOf(today, settings(db).settlementWeekStart as WeekDay);
      return {
        workers: siteWorkers(db, projectId).length,
        marked: attendanceOn(db, projectId, today).length,
        incoming: incomingDispatches(db, projectId).length + incomingPurchases(db, projectId).length,
        floats: pendingFloats(db, acc?.id).length,
        account: acc,
        settlement: settlementFor(db, projectId, week.weekStart),
        log: myLogOn(db, projectId, user.id, today),
      };
    },
    [projectId, today, user.id],
  );

  const header = <HomeHeader name={user.name.split(' ')[0] ?? user.name} date={longDate(today)} />;
  if (!project || !data) {
    return (
      <Screen header={header} safeTop={false}>
        <EmptyState icon="🏗️" title={t('aaj.noSite')} />
      </Screen>
    );
  }

  const todo: { icon: string; tone: BadgeTone; title: string; done: boolean; href: Href; testID: string }[] = [
    {
      icon: '👷',
      tone: 'primary',
      title: data.marked > 0 ? t('aaj.hazriDone', { n: `${data.marked}/${data.workers}` }) : t('aaj.markHazri'),
      done: data.marked > 0 && data.marked >= data.workers,
      href: '/hazri',
      testID: 'todo-hazri',
    },
    { icon: '📝', tone: 'violet', title: data.log ? t('aaj.logDone') : t('aaj.logMissing'), done: !!data.log, href: '/log/today', testID: 'todo-log' },
  ];
  if (data.incoming) todo.push({ icon: '🚚', tone: 'info', title: t('aaj.incoming', { n: data.incoming }), done: false, href: '/maal', testID: 'todo-incoming' });
  if (data.floats) todo.push({ icon: '💵', tone: 'success', title: t('aaj.floats', { n: data.floats }), done: false, href: '/kharcha', testID: 'todo-floats' });
  if (data.settlement) {
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

  const quick: { icon: string; tone: BadgeTone; label: string; href: Href }[] = [
    { icon: '👷', tone: 'primary', label: t('tabs.hazri'), href: '/hazri' },
    { icon: '🧱', tone: 'accent', label: t('maal.usage'), href: '/maal/usage' },
    { icon: '💵', tone: 'success', label: t('kharcha.add'), href: '/kharcha/new' },
    { icon: '📝', tone: 'violet', label: t('mazeed.dailyLog'), href: '/log/today' },
    { icon: '🤝', tone: 'info', label: t('hazri.peshgi'), href: '/hazri/peshgi' },
    { icon: '📦', tone: 'danger', label: t('maal.ownerDelivery'), href: '/maal/owner-delivery' },
  ];

  return (
    <Screen header={header} safeTop={false}>
      {data.account ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/kharcha')} className="overflow-hidden rounded-card bg-accent p-5 active:opacity-95" style={RAISED_SHADOW}>
          <View className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/30" />
          <View className="flex-row items-center justify-between">
            <Text className="font-medium text-sm text-ink">{t('aaj.myCash')}</Text>
            <View className="h-9 w-9 items-center justify-center rounded-full bg-brand">
              <Icon name="wallet-outline" size={18} color={COLORS.accent} />
            </View>
          </View>
          <MoneyText paisa={data.account.balancePaisa} className="mt-1 text-3xl !text-ink" />
          <View className="mt-3 flex-row items-center gap-1">
            <Text className="font-semibold text-xs text-ink">{t('kharcha.title')}</Text>
            <Icon name="arrow-right" size={14} color={COLORS.ink} />
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

      <Text className="mt-3 font-bold text-lg text-ink">{t('aaj.quick')}</Text>
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
