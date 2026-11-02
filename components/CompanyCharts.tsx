import { View } from 'react-native';
import type { Overview } from '@/features/office';
import { useI18n } from '@/i18n';
import { formatPKR, toPaisa } from '@/lib/money';
import { BarList, ChartCard, Meter } from './Charts';

/**
 * The company charts (money access only): how much of what was billed has come in, and where the
 * money is still out — the five projects owing the most.
 */
export function CompanyCharts({ overview }: { overview: Overview }) {
  const { t } = useI18n();
  const k = overview.kpis;
  if (!overview.seesFinancials || k.receivablesOutstandingPaisa === undefined) return null;
  const owing = overview.projects
    .filter((p) => p.outstandingPaisa && toPaisa(p.outstandingPaisa) > 0n)
    .sort((a, b) => (toPaisa(b.outstandingPaisa) > toPaisa(a.outstandingPaisa) ? 1 : -1))
    .slice(0, 5)
    .map((p) => ({ key: p.project.id, label: `${p.project.code} · ${p.project.name}`, value: Number(toPaisa(p.outstandingPaisa) / 100n), display: formatPKR(p.outstandingPaisa) }));
  return (
    <View className="gap-3">
      {k.collectedPercent !== undefined ? (
        <ChartCard testID="chart-collected" title={t('chart.collected')}>
          <Meter percent={k.collectedPercent} label={t('chart.ofBilled')} detail={k.receivedPaisa ? t('chart.receivedOf', { received: formatPKR(k.receivedPaisa), billed: formatPKR(k.invoicedPaisa) }) : undefined} />
        </ChartCard>
      ) : null}
      {owing.length ? (
        <ChartCard testID="chart-owing" title={t('chart.owing')} subtitle={t('chart.owingHint')}>
          <BarList rows={owing} />
        </ChartCard>
      ) : null}
    </View>
  );
}
