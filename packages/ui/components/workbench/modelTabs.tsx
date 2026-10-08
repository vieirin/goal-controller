'use client';

import type { TransformEngine } from '@/lib/types';
import ModelDiagram from './engines/ModelDiagram';
import NotationView from './engines/edgeLangium/NotationView';
import SourceView from './SourceView';
import { useWorkbench, type ModelTab } from './WorkbenchContext';

/** The model's views: the diagram, its piStar source, and for EdgeLangium the notation. */
export const modelTabsFor = (
  engine: TransformEngine,
): Array<{ id: ModelTab; label: string }> => [
  { id: 'diagram', label: 'Goal Model' },
  ...(engine === 'edgelangium'
    ? [{ id: 'notation' as const, label: 'Notation' }]
    : []),
  { id: 'source', label: 'Source' },
];

/** The open model tab's view (the diagram when the tab is not offered for this engine). */
export function ModelTabView() {
  const wb = useWorkbench();
  const tab = modelTabsFor(wb.engine).some(({ id }) => id === wb.modelTab)
    ? wb.modelTab
    : 'diagram';
  if (tab === 'source') return <SourceView />;
  if (tab === 'notation') return <NotationView />;
  return <ModelDiagram />;
}
