import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CARD_SHADOW } from '@/lib/theme';

/** A titled card around a chart (the web dashboard's chart card). */
export function ChartCard({ title, subtitle, children, testID }: { title: string; subtitle?: string; children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="gap-3 rounded-card border border-border bg-card p-4" style={CARD_SHADOW}>
      <View className="gap-0.5">
        <Text className="font-semibold text-base text-ink">{title}</Text>
        {subtitle ? <Text className="text-xs text-muted">{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Columns for one series over a few periods (e.g. attendance per day). Thin bars with 4 px rounded
 * tops on a recessive baseline; tap a column to read its value (the latest one is shown at first).
 */
export function ColumnChart({ data, height = 120, testID }: { data: { key: string; label: string; value: number; display?: string }[]; height?: number; testID?: string }) {
  const [picked, setPicked] = useState(data.length - 1);
  const max = Math.max(1, ...data.map((d) => d.value));
  const shown = data[picked];
  return (
    <View testID={testID} className="gap-2">
      <Text className="text-sm text-muted">
        {shown ? (
          <>
            <Text className="font-semibold text-ink">{shown.display ?? String(shown.value)}</Text> · {shown.label}
          </>
        ) : null}
      </Text>
      <View className="flex-row items-end gap-2 border-b border-border" style={{ height }}>
        {data.map((d, i) => (
          <Pressable key={d.key} testID={`col-${d.key}`} accessibilityRole="button" accessibilityLabel={`${d.label}: ${d.display ?? d.value}`} onPress={() => setPicked(i)} className="h-full flex-1 justify-end">
            <View className={`rounded-t ${i === picked ? 'bg-primary' : 'bg-primary/40'}`} style={{ height: Math.max(2, (d.value / max) * (height - 4)) }} />
          </Pressable>
        ))}
      </View>
      <View className="flex-row gap-2">
        {data.map((d, i) => (
          <Text key={d.key} className={`flex-1 text-center text-xs ${i === picked ? 'font-semibold text-ink' : 'text-muted'}`}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars for one measure across a few named things (e.g. outstanding per project), largest first. */
export function BarList({ rows, testID }: { rows: { key: string; label: string; value: number; display: string }[]; testID?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View testID={testID} className="gap-3">
      {rows.map((r) => (
        <View key={r.key} className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {r.label}
            </Text>
            <Text className="text-sm font-semibold text-ink">{r.display}</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-border">
            <View className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A part of a whole as a meter (e.g. collected of invoiced): the number leads, the bar supports it. */
export function Meter({ percent, label, detail, testID }: { percent: number; label: string; detail?: string; testID?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View testID={testID} className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-2xl font-semibold text-ink">{Math.round(p)}%</Text>
        <Text className="text-sm text-muted">{label}</Text>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-border">
        <View className="h-full rounded-full bg-success" style={{ width: `${p}%` }} />
      </View>
      {detail ? <Text className="text-xs text-muted">{detail}</Text> : null}
    </View>
  );
}
