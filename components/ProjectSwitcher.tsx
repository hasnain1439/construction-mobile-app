import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useT } from '@/i18n';
import { useProject } from '@/features/project';
import { BottomSheet } from './BottomSheet';
import { ListItem } from './ListItem';

/** Chip with the current site; tap to switch (only shown when there is more than one). */
export function ProjectSwitcher() {
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
        className="min-h-12 max-w-48 flex-row items-center gap-1 rounded-full bg-primary-soft px-3"
      >
        <Text className="font-semibold text-sm text-primary" numberOfLines={1}>
          📍 {project.name}
        </Text>
        {many ? <Text className="text-primary">▾</Text> : null}
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('common.chooseProject')}>
        {projects.map((p) => (
          <ListItem
            key={p.id}
            title={p.name}
            subtitle={[p.code, p.city].filter(Boolean).join(' · ')}
            right={p.id === project.id ? <Text className="text-xl text-primary">✓</Text> : undefined}
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
