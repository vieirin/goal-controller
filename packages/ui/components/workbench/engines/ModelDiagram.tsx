'use client';

import { useWorkbench } from '../WorkbenchContext';
import EdgeDiagram from './edge/EdgeDiagram';
import EdgeV2Diagram from './edgeV2/EdgeV2Diagram';
import GodaDiagram from './goda/GodaDiagram';
import GrlDiagram from './grl/GrlDiagram';
import IstardtDiagram from './istardt/IstardtDiagram';
import MutroseDiagram from './mutrose/MutroseDiagram';
import PistarDiagram from './pistar/PistarDiagram';
import PistarExtDiagram from './pistarExt/PistarExtDiagram';
import SleecDiagram from './sleec/SleecDiagram';
import Tropos4asDiagram from './tropos4as/Tropos4asDiagram';
import CgmDiagram from './cgm/CgmDiagram';
import FrameworkDiagram from './framework/FrameworkDiagram';
import { frameworkEditorOf } from '@/lib/workbench/frameworkModes';

/** The goal model's diagram for the mode the model is in. */
export default function ModelDiagram() {
  const wb = useWorkbench();
  switch (wb.mode) {
    case 'pistar':
      return <PistarDiagram />;
    case 'pistarext':
      return <PistarExtDiagram />;
    // the frameworks' engines draw their framework's model, typed with the
    // engine's own dialect (nfrprop's `initialLabel`, goal-controller#327)
    case 'kaos':
    case 'nfr':
    case 'kaosdoc':
    case 'kaosprop':
    case 'nfrprop':
      return <FrameworkDiagram {...frameworkEditorOf(wb.mode)!} />;
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
    case 'grl':
      return <GrlDiagram />;
    case 'istardt':
      return <IstardtDiagram />;
    case 'tropos4as':
      return <Tropos4asDiagram />;
    case 'cgm':
      return <CgmDiagram />;
  }
}
