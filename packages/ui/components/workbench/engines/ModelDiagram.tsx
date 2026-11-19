'use client';

import { useWorkbench } from '../WorkbenchContext';
import PistarDiagram from './pistar/PistarDiagram';
import PistarExtDiagram from './pistarExt/PistarExtDiagram';
import FrameworkDiagram from './framework/FrameworkDiagram';
import { EngineDiagram } from './engineViews';
import { frameworkEditorOf } from '@/lib/workbench/frameworkModes';
import { isEngineMode } from '@/lib/workbench/pistar';
import { resourceEntries } from '@/lib/workbench/projectResources';

/** The goal model's diagram for the mode the model is in. */
export default function ModelDiagram() {
  const wb = useWorkbench();
  if (wb.mode === 'pistar') return <PistarDiagram />;
  if (wb.mode === 'pistarext') return <PistarExtDiagram />;
  // a framework's modes and its engines draw their framework's model, typed
  // with the engine's own dialect (nfrprop's `initialLabel`, goal-controller#327)
  const framework = frameworkEditorOf(wb.mode);
  if (framework)
    return (
      <FrameworkDiagram
        {...framework}
        entries={resourceEntries(wb.parsedResources)}
      />
    );
  // an engine's own canvas: remounted when the engine changes
  return isEngineMode(wb.mode) ? (
    <EngineDiagram key={wb.mode} engine={wb.mode} />
  ) : null;
}
