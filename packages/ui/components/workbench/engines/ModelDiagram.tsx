'use client';

import { useWorkbench } from '../WorkbenchContext';
import EdgeDiagram from './edge/EdgeDiagram';
import EdgeV2Diagram from './edgeV2/EdgeV2Diagram';
import GodaDiagram from './goda/GodaDiagram';
import MutroseDiagram from './mutrose/MutroseDiagram';
import PistarDiagram from './pistar/PistarDiagram';
import PistarExtDiagram from './pistarExt/PistarExtDiagram';
import SleecDiagram from './sleec/SleecDiagram';

/** The goal model's diagram for the mode the model is in. */
export default function ModelDiagram() {
  const wb = useWorkbench();
  switch (wb.mode) {
    case 'pistar':
      return <PistarDiagram />;
    case 'pistarext':
      return <PistarExtDiagram />;
    case 'edge':
      return <EdgeDiagram />;
    case 'edgev2':
      return <EdgeV2Diagram />;
    case 'sleec':
      return <SleecDiagram />;
    case 'mutrose':
      return <MutroseDiagram />;
    case 'goda':
      return <GodaDiagram />;
  }
}
