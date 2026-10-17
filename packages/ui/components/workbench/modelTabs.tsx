'use client';

import type { TransformEngine } from '@/lib/types';
import type { NativeSlot, ResourceSlot } from '@/lib/project';
import { isDialectEngine } from '@/lib/workbench/engineDialects';
import { isDialectMode } from '@/lib/workbench/dialects';
import { isFrameworkMode } from '@/lib/workbench/frameworkModes';
import { resourceTabId } from '@/lib/workbench/projectResources';
import type { ModelMode } from '@/lib/workbench/pistar';
import PistarExtNotationView from './engines/pistarExt/PistarExtNotationView';
import ModelDiagram from './engines/ModelDiagram';
import NativeView from './NativeView';
import NotationView from './engines/definition/NotationView';
import ResourceView from './ResourceView';
import SourceView from './SourceView';
import { useWorkbench, type ModelTab } from './WorkbenchContext';

/**
 * The model's views: the diagram, its piStar source, and the notation where the engine
 * has a definition, or in a dialect's mode (its own lines); then one tab per native
 * file of the model (goal-controller#143), and per file of the project's resources
 * (goal-controller#25).
 */
export const modelTabsFor = (
  mode: ModelMode,
  engine: TransformEngine,
  resources: readonly ResourceSlot[] = [],
  /** the project's other files opened in a tab (outputs, notes) */
  opened: readonly string[] = [],
  natives: readonly NativeSlot[] = [],
): Array<{ id: ModelTab; label: string }> => [
  { id: 'diagram', label: 'Goal Model' },
  // a framework's model has no engine's notation (its own view is PR B's, #171)
  ...(!isFrameworkMode(mode) && (isDialectMode(mode) || isDialectEngine(engine))
    ? [{ id: 'notation' as const, label: 'Notation' }]
    : []),
  { id: 'source', label: 'Source' },
  ...[
    ...new Set([
      ...natives.flatMap((slot) => (slot.missing ? [] : [slot.path])),
      ...resources.flatMap((slot) => slot.paths),
      ...opened,
    ]),
  ].map((path) => ({
    id: resourceTabId(path),
    label: path.split('/').pop() ?? path,
  })),
];

/** The open model tab's view (the diagram when the tab is not offered for this engine). */
export function ModelTabView() {
  const wb = useWorkbench();
  const tab = modelTabsFor(
    wb.mode,
    wb.engine,
    wb.resourceSlots,
    wb.openedFiles,
    wb.nativeSlots,
  ).some(({ id }) => id === wb.modelTab)
    ? wb.modelTab
    : 'diagram';
  if (tab.startsWith('resource:')) {
    const path = tab.slice('resource:'.length);
    return wb.nativeStates.some((state) => state.slot.path === path) ? (
      <NativeView key={tab} path={path} />
    ) : (
      <ResourceView key={tab} path={path} />
    );
  }
  if (tab === 'source') return <SourceView />;
  if (tab === 'notation' && isDialectMode(wb.mode))
    return <PistarExtNotationView />;
  if (tab === 'notation' && isDialectEngine(wb.engine))
    return <NotationView key={wb.engine} engine={wb.engine} />;
  return <ModelDiagram />;
}
