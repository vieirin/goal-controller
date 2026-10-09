'use client';

import type { TransformEngine } from '@/lib/types';
import type { ResourceSlot } from '@/lib/project';
import { isDialectEngine } from '@/lib/workbench/engineDialects';
import { isDialectMode } from '@/lib/workbench/dialects';
import { resourceTabId } from '@/lib/workbench/projectResources';
import type { ModelMode } from '@/lib/workbench/pistar';
import PistarExtNotationView from './engines/pistarExt/PistarExtNotationView';
import ModelDiagram from './engines/ModelDiagram';
import NotationView from './engines/definition/NotationView';
import ResourceView from './ResourceView';
import SourceView from './SourceView';
import { useWorkbench, type ModelTab } from './WorkbenchContext';

/**
 * The model's views: the diagram, its piStar source, and the notation where the engine
 * has a definition, or in a dialect's mode (its own lines); then one tab per file of
 * the project's resources (goal-controller#25).
 */
export const modelTabsFor = (
  mode: ModelMode,
  engine: TransformEngine,
  resources: readonly ResourceSlot[] = [],
): Array<{ id: ModelTab; label: string }> => [
  { id: 'diagram', label: 'Goal Model' },
  ...(isDialectMode(mode) || isDialectEngine(engine)
    ? [{ id: 'notation' as const, label: 'Notation' }]
    : []),
  { id: 'source', label: 'Source' },
  ...resources.flatMap((slot) =>
    slot.paths.map((path) => ({
      id: resourceTabId(path),
      label: path.split('/').pop() ?? path,
    })),
  ),
];

/** The open model tab's view (the diagram when the tab is not offered for this engine). */
export function ModelTabView() {
  const wb = useWorkbench();
  const tab = modelTabsFor(wb.mode, wb.engine, wb.resourceSlots).some(
    ({ id }) => id === wb.modelTab,
  )
    ? wb.modelTab
    : 'diagram';
  if (tab.startsWith('resource:'))
    return <ResourceView key={tab} path={tab.slice('resource:'.length)} />;
  if (tab === 'source') return <SourceView />;
  if (tab === 'notation' && isDialectMode(wb.mode))
    return <PistarExtNotationView />;
  if (tab === 'notation' && isDialectEngine(wb.engine))
    return <NotationView key={wb.engine} engine={wb.engine} />;
  return <ModelDiagram />;
}
