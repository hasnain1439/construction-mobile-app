import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from '@/db/live';
import { materials } from '@/features/queries';
import { useT } from '@/i18n';
import { CARD_SHADOW, COLORS } from '@/lib/theme';
import { BigButton } from './BigButton';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { ListItem } from './ListItem';
import { QuantityInput } from './QuantityInput';

export interface Line {
  materialId: string;
  qty: string;
}

interface Props {
  value: Line[];
  onChange: (lines: Line[]) => void;
  /** Extra text under each line (e.g. "In stock 40 bags"). */
  hint?: (materialId: string) => string | null;
  error?: (line: Line) => string | null;
}

/** Material + quantity lines with a searchable picker (names and units only — no rates). */
export function MaterialLines({ value, onChange, hint, error }: Props) {
  const t = useT();
  const all = useQuery((db) => materials(db), []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
  const options = all.filter((m) => !value.some((l) => l.materialId === m.id) && m.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <View className="gap-3">
      {value.map((l, i) => {
        const m = byId.get(l.materialId);
        return (
          <View key={l.materialId} className="gap-2 rounded-card bg-card p-4" style={CARD_SHADOW}>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 font-semibold text-base text-ink">{m?.name ?? '—'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} onPress={() => onChange(value.filter((_, n) => n !== i))} className="-mr-2 h-12 w-12 items-center justify-center rounded-full active:bg-danger-soft">
                <Icon name="close" size={22} color={COLORS.danger} />
              </Pressable>
            </View>
            <QuantityInput testID={`qty-${m?.name ?? i}`} value={l.qty} unit={m?.unit} onChange={(qty) => onChange(value.map((x, n) => (n === i ? { ...x, qty } : x)))} error={error?.(l) ?? null} />
            {hint?.(l.materialId) ? <Text className="text-xs text-muted">{hint(l.materialId)}</Text> : null}
          </View>
        );
      })}
      <BigButton testID="add-material" small variant="secondary" icon="➕" label={t('maal.addLine')} onPress={() => setOpen(true)} />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('maal.material')}>
        <View className="min-h-12 flex-row items-center gap-2 rounded-xl border border-border bg-bg px-3">
          <Icon name="magnify" size={20} color={COLORS.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('common.search')} placeholderTextColor={COLORS.neutral} className="min-h-12 flex-1 text-base text-ink" />
        </View>
        {options.map((m) => (
          <ListItem
            key={m.id}
            title={m.name}
            subtitle={m.unit}
            icon="🧱"
            iconTone="accent"
            onPress={() => {
              onChange([...value, { materialId: m.id, qty: '' }]);
              setSearch('');
              setOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

/** Lines with a positive quantity → numbers. */
export const parsedLines = (lines: Line[]) => lines.map((l) => ({ materialId: l.materialId, qty: Number(l.qty) })).filter((l) => Number.isFinite(l.qty) && l.qty > 0);
