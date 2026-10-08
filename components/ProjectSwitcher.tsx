import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useT } from '@/i18n';
import { useProject } from '@/features/project';
import { COLORS } from '@/lib/theme';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { ListItem } from './ListItem';

/** Chip with the current site; tap to switch (only shown when there is more than one). `onDark` for the navy home header. */
export function ProjectSwitcher({ onDark = false }: { onDark?: boolean }) {
  const t = useT();
  const { project, projects, setProjectId } = useProject();
  const [open, setOpen] = useState(false);
  if (!project) return null;
  const many = projects.length > 1;
  return (
    <>
      <Pressable
        testID="project-switcher"
        accessibilityRole="button"
        accessibilityLabel={t('common.chooseProject')}
        disabled={!many}
        onPress={() => setOpen(true)}
        className={`min-h-10 max-w-48 flex-row items-center gap-1.5 rounded-full px-3 ${onDark ? 'bg-white/10' : 'bg-primary-soft'}`}
      >
        <Icon name="map-marker" size={16} color={onDark ? COLORS.accent : COLORS.primary} />
        <Text className={`shrink font-semibold text-sm ${onDark ? 'text-white' : 'text-primary'}`} numberOfLines={1}>
          {project.name}
        </Text>
        {many ? <Icon name="chevron-down" size={16} color={onDark ? COLORS.white : COLORS.primary} /> : null}
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('common.chooseProject')}>
        {projects.map((p) => (
          <ListItem
            key={p.id}
            title={p.name}
            subtitle={[p.code, p.city].filter(Boolean).join(' · ')}
            icon="map-marker-outline"
            iconTone={p.id === project.id ? 'primary' : 'neutral'}
            right={p.id === project.id ? <Icon name="check-circle" size={22} color={COLORS.primary} /> : <View />}
            onPress={() => {
              setProjectId(p.id);
              setOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </>
  );
}
