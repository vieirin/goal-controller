'use client';

import { useWorkbench } from '../WorkbenchContext';
import EdgeDiagram from './edge/EdgeDiagram';
import EdgeV2Diagram from './edgeV2/EdgeV2Diagram';
import PistarDiagram from './pistar/PistarDiagram';
import SleecDiagram from './sleec/SleecDiagram';

/** The goal model's diagram for the mode the model is in. */
export default function ModelDiagram() {
  const wb = useWorkbench();
  switch (wb.mode) {
    case 'pistar':
      return <PistarDiagram />;
    case 'edge':
      return <EdgeDiagram />;
    case 'edgev2':
    case 'edgelangium':
      return <EdgeV2Diagram />;
    case 'sleec':
      return <SleecDiagram />;
  }
}
