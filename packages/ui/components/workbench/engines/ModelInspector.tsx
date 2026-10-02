'use client';

import { useWorkbench } from '../WorkbenchContext';
import EdgeInspector from './edge/EdgeInspector';
import EdgeV2Inspector from './edgeV2/EdgeV2Inspector';
import SleecInspector from './sleec/SleecInspector';

/**
 * The inspector for the mode the model is in. piStar mode has none here: its diagram
 * carries the editor's own inspector (engines/pistar/PistarDiagram.tsx).
 */
export default function ModelInspector() {
  const wb = useWorkbench();
  switch (wb.mode) {
    case 'pistar':
      return null;
    case 'edge':
      return <EdgeInspector />;
    case 'edgev2':
      return <EdgeV2Inspector />;
    case 'sleec':
      return <SleecInspector />;
  }
}
