'use client';

import { useWorkbench } from '../WorkbenchContext';
import EdgeInspector from './edge/EdgeInspector';
import EdgeV2Inspector from './edgeV2/EdgeV2Inspector';
import SleecInspector from './sleec/SleecInspector';

/**
 * The inspector for the mode the model is in. piStar mode and piStar-ext have none here:
 * their diagrams carry their inspectors (engines/pistar/, engines/pistarExt/).
 */
export default function ModelInspector() {
  const wb = useWorkbench();
  switch (wb.mode) {
    case 'pistar':
    case 'pistarext':
      return null;
    case 'edge':
      return <EdgeInspector />;
    case 'edgev2':
      return <EdgeV2Inspector />;
    case 'sleec':
      return <SleecInspector />;
  }
}
