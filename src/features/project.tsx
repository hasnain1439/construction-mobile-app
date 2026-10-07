/** The site the munshi is working on (remembered on the phone; defaults to the first one). */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getDb } from '../db/client';
import { getKv, setKv } from '../db/kv';
import { useQuery } from '../db/live';
import { projects } from './queries';
import type { ProjectRow } from './types';

interface ProjectCtx {
  projectId: string | null;
  project: ProjectRow | null;
  projects: ProjectRow[];
  setProjectId: (id: string) => void;
}

const Ctx = createContext<ProjectCtx>({ projectId: null, project: null, projects: [], setProjectId: () => undefined });

export function ProjectProvider({ children }: { children: ReactNode }) {
  const list = useQuery((db) => projects(db), []);
  const [chosen, setChosen] = useState<string | null>(() => getKv(getDb(), 'project.current'));
  const project = list.find((p) => p.id === chosen) ?? list[0] ?? null;
  const setProjectId = useCallback((id: string) => {
    setKv(getDb(), 'project.current', id);
    setChosen(id);
  }, []);
  const value = useMemo(() => ({ projectId: project?.id ?? null, project, projects: list, setProjectId }), [project, list, setProjectId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useProject = () => useContext(Ctx);
