/**
 * Server names in the person's language. Milestone names come from the server in English
 * ("First floor — columns & brickwork"); the stable `key` (`F1_STRUCTURE.WALLS`) gives the same
 * name in Roman Urdu / Urdu. Anything the app does not know is shown as the office wrote it.
 */
import { translateMaybe, type Language } from '../i18n';
import type { MilestoneRow } from './types';

export const stageLabel = (language: Language, stageKey: string, fallback: string) => translateMaybe(language, `stage.${stageKey}`) ?? fallback;

export function milestoneLabel(language: Language, m: Pick<MilestoneRow, 'key' | 'stageKey' | 'name'>): string {
  const [stage, part] = m.key.split('.');
  const s = stage ? translateMaybe(language, `stage.${stage}`) : null;
  const p = part ? translateMaybe(language, `mspart.${part}`) : null;
  return s && p ? `${s} — ${p}` : m.name;
}
