'use client';

import type { TransformEngine } from '@/lib/types';
import { isDefinedEngine } from '@/lib/workbench/definitions';
import { isDialectMode } from '@/lib/workbench/dialects';
import type { ModelMode } from '@/lib/workbench/pistar';
import PistarExtNotationView from './engines/pistarExt/PistarExtNotationView';
import ModelDiagram from './engines/ModelDiagram';
import NotationView from './engines/definition/NotationView';
import SourceView from './SourceView';
import { useWorkbench, type ModelTab } from './WorkbenchContext';

/**
 * The model's views: the diagram, its piStar source, and the notation where the engine
 * has a definition, or in a dialect's mode (its own lines).
 */
export const modelTabsFor = (
  mode: ModelMode,
  engine: TransformEngine,
): Array<{ id: ModelTab; label: string }> => [
  { id: 'diagram', label: 'Goal Model' },
  ...(isDialectMode(mode) || isDefinedEngine(engine)
    ? [{ id: 'notation' as const, label: 'Notation' }]
    : []),
  { id: 'source', label: 'Source' },
];

/** The open model tab's view (the diagram when the tab is not offered for this engine). */
export function ModelTabView() {
  const wb = useWorkbench();
  const tab = modelTabsFor(wb.mode, wb.engine).some(
    ({ id }) => id === wb.modelTab,
  )
    ? wb.modelTab
    : 'diagram';
  if (tab === 'source') return <SourceView />;
  if (tab === 'notation' && isDialectMode(wb.mode))
    return <PistarExtNotationView />;
  if (tab === 'notation' && isDefinedEngine(wb.engine))
    return <NotationView key={wb.engine} engine={wb.engine} />;
  return <ModelDiagram />;
}
