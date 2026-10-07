import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { EmptyState } from '@components/EmptyState';
import { Header } from '@components/Header';
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

  const header = <Header title={t('aaj.greeting', { name: user.name.split(' ')[0] ?? user.name })} subtitle={longDate(today)} right={<ProjectSwitcher />} />;
  if (!project || !data) {
    return (
      <Screen header={header}>
        <EmptyState icon="🏗️" title={t('aaj.noSite')} />
      </Screen>
    );
  }

  const todo: { icon: string; title: string; done: boolean; href: Href; testID: string }[] = [
    { icon: '👷', title: data.marked > 0 ? t('aaj.hazriDone', { n: `${data.marked}/${data.workers}` }) : t('aaj.markHazri'), done: data.marked > 0 && data.marked >= data.workers, href: '/hazri', testID: 'todo-hazri' },
    { icon: '📝', title: data.log ? t('aaj.logDone') : t('aaj.logMissing'), done: !!data.log, href: '/log/today', testID: 'todo-log' },
  ];
  if (data.incoming) todo.push({ icon: '🚚', title: t('aaj.incoming', { n: data.incoming }), done: false, href: '/maal', testID: 'todo-incoming' });
  if (data.floats) todo.push({ icon: '💵', title: t('aaj.floats', { n: data.floats }), done: false, href: '/kharcha', testID: 'todo-floats' });
  if (data.settlement) todo.push({ icon: '🗓️', title: t('aaj.settlement', { status: t(`settlement.${data.settlement.status}` as never) }), done: data.settlement.status === 'APPROVED', href: '/hazri/settlement', testID: 'todo-settlement' });

  const quick: { icon: string; label: string; href: Href }[] = [
    { icon: '👷', label: t('tabs.hazri'), href: '/hazri' },
    { icon: '🧱', label: t('maal.usage'), href: '/maal/usage' },
    { icon: '💵', label: t('kharcha.add'), href: '/kharcha/new' },
    { icon: '📝', label: t('mazeed.dailyLog'), href: '/log/today' },
    { icon: '🤝', label: t('hazri.peshgi'), href: '/hazri/peshgi' },
    { icon: '📦', label: t('maal.ownerDelivery'), href: '/maal/owner-delivery' },
  ];

  return (
    <Screen header={header}>
      <Text className="font-semibold text-base text-ink">{t('aaj.todo')}</Text>
      {todo.map((item) => (
        <ListItem
          key={item.testID}
          testID={item.testID}
          left={<Text className="text-2xl">{item.icon}</Text>}
          title={item.title}
          right={item.done ? <StatusChip tone="success" label="✓" /> : <Text className="text-xl text-muted">›</Text>}
          onPress={() => router.push(item.href)}
        />
      ))}

      {data.account ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/kharcha')} className="gap-1 rounded-card bg-primary p-4 active:opacity-90">
          <Text className="font-medium text-sm text-white/80">{t('aaj.myCash')}</Text>
          <MoneyText paisa={data.account.balancePaisa} className="text-3xl !text-white" />
        </Pressable>
      ) : null}

      <Text className="mt-2 font-semibold text-base text-ink">{t('aaj.quick')}</Text>
      <View className="flex-row flex-wrap gap-3">
        {quick.map((q) => (
          <Pressable key={q.label} accessibilityRole="button" accessibilityLabel={q.label} onPress={() => router.push(q.href)} className="min-h-24 w-[30%] flex-grow items-center justify-center gap-1 rounded-card border border-border bg-card p-3 active:bg-bg">
            <Text className="text-3xl">{q.icon}</Text>
            <Text className="text-center font-medium text-sm text-ink" numberOfLines={2}>
              {q.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
