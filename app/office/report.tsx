import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { BigButton } from '@components/BigButton';
import { Header } from '@components/Header';
import { MoneyText } from '@components/MoneyText';
import { OfficeCard, OfficeSearch, OfficeState } from '@components/OfficeParts';
import { Screen } from '@components/Screen';
import { ENDPOINTS } from '@/api/endpoints';
import { usePermissions } from '@/features/access';
import { reportFile, reportsFor, useOnline, type Cell, type ColumnType, type ReportTable } from '@/features/office';
import { ApiError, NetworkError } from '@/api/client';
import { errorText, useI18n } from '@/i18n';
import { CARD_SHADOW } from '@/lib/theme';

/** One value by column type: money in rupees, quantities with up to 3 decimals, dates in the app language. */
function Value({ type, value }: { type: ColumnType; value: Cell | undefined }) {
  const { f } = useI18n();
  if (value === null || value === undefined || value === '') return <Text className="text-sm text-muted">—</Text>;
  if (type === 'money') return <MoneyText paisa={String(value)} className={`text-sm ${String(value).startsWith('-') ? 'text-danger' : ''}`} />;
  if (type === 'qty' || type === 'int') return <Text className="text-sm font-medium text-ink">{Number(value).toLocaleString('en-PK', { maximumFractionDigits: 3 })}</Text>;
  if (type === 'percent') return <Text className="text-sm font-medium text-ink">{value}%</Text>;
  if (type === 'date') return <Text className="text-sm font-medium text-ink">{f.shortDate(String(value))}</Text>;
  return (
    <Text className="max-w-[60%] text-right text-sm font-medium text-ink" numberOfLines={3}>
      {String(value)}
    </Text>
  );
}

/**
 * Office → one report: its totals, then every row as a card (the first text columns are the card's
 * title, the rest label · value) — the table of the web, readable on a phone. PDF opens the same
 * report as a file to share.
 */
export default function OfficeReport() {
  const { t, language } = useI18n();
  const p = usePermissions();
  const { name } = useLocalSearchParams<{ name: string }>();
  const def = reportsFor(p.access, p.role).find((r) => r.name === name);
  const { state, data, reload } = useOnline<ReportTable>(def ? ENDPOINTS.report(def.name) : null);
  const [q, setQ] = useState('');
  const [pdf, setPdf] = useState<'idle' | 'busy' | string>('idle');

  const columns = data?.columns ?? [];
  const textCols = columns.filter((c) => c.type === 'text').slice(0, 2).map((c) => c.key);
  const needle = q.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter((r) => !needle || columns.some((c) => c.type === 'text' && String(r[c.key] ?? '').toLowerCase().includes(needle)));
  const totals = data?.totals ? columns.filter((c) => c.type !== 'text' && data.totals![c.key] !== null && data.totals![c.key] !== undefined) : [];

  const openPdf = async () => {
    if (!def) return;
    setPdf('busy');
    try {
      const file = await reportFile(def.name, 'pdf');
      await Linking.openURL(file.url);
      setPdf('idle');
    } catch (e) {
      setPdf(errorText(language, e instanceof ApiError ? e.code : e instanceof NetworkError ? 'OFFLINE' : null));
    }
  };

  return (
    <Screen refresh={false} header={<Header back title={def ? t(def.title) : t('office.reports')} subtitle={data?.subtitle ?? undefined} />}>
      <OfficeState state={def ? state : 'denied'} onRetry={() => void reload()}>
        <BigButton small variant="secondary" icon="file-pdf-box" label={t('office.openPdf')} loading={pdf === 'busy'} onPress={() => void openPdf()} testID="report-pdf" />
        {pdf !== 'idle' && pdf !== 'busy' ? <Text className="text-sm text-danger">{pdf}</Text> : null}
        {totals.length ? (
          <View testID="report-totals" className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
            <Text className="font-semibold text-base text-ink">{t('office.totals')}</Text>
            {totals.map((c) => (
              <View key={c.key} className="flex-row items-center justify-between gap-3">
                <Text className="text-sm text-muted">{c.label}</Text>
                <Value type={c.type} value={data!.totals![c.key]} />
              </View>
            ))}
          </View>
        ) : null}
        {data?.notes?.length ? <Text className="text-xs text-muted">{data.notes.join(' ')}</Text> : null}
        <Text className="font-semibold text-ink">{t('office.rows', { n: rows.length })}</Text>
        {(data?.rows.length ?? 0) > 5 ? <OfficeSearch testID="report-search" value={q} onChange={setQ} placeholder={t('office.searchRows')} /> : null}
        {rows.map((r, i) => (
          <OfficeCard
            key={i}
            title={textCols.map((k) => r[k]).filter((v) => v !== null && v !== undefined && v !== '').join(' · ') || '—'}
            lines={columns.filter((c) => !textCols.includes(c.key)).map((c) => [c.label, <Value key={c.key} type={c.type} value={r[c.key]} />])}
          />
        ))}
      </OfficeState>
    </Screen>
  );
}
