'use client';

import { frameworkEditorOf } from '@/lib/workbench/frameworkModes';
import { isEngineMode, type ModelMode } from '@/lib/workbench/pistar';
import { useWorkbench } from '../WorkbenchContext';
import { EngineInspector } from './engineViews';

/**
 * Whether the workbench shows a mode's inspector in its own panel (or sheet):
 * an engine's, but a framework engine's (kaosdoc, nfrprop), whose diagram
 * carries istar-ts's inspector as the framework's modes do (one inspector,
 * goal-controller#171).
 */
export const hasModelInspector = (mode: ModelMode): boolean =>
  isEngineMode(mode) && !frameworkEditorOf(mode);

/**
 * The inspector for the mode the model is in. piStar mode, piStar-ext, the frameworks
 * and their engines have none here: their diagrams carry their inspectors
 * (engines/pistar/, engines/pistarExt/, engines/framework/).
 */
export default function ModelInspector() {
  const wb = useWorkbench();
  return hasModelInspector(wb.mode) && isEngineMode(wb.mode) ? (
    <EngineInspector key={wb.mode} engine={wb.mode} />
  ) : null;
}
