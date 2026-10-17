'use client';

import { frameworkEditorOf } from '@/lib/workbench/frameworkModes';
import { isEngineMode, type ModelMode } from '@/lib/workbench/pistar';
import { useWorkbench } from '../WorkbenchContext';
import EdgeInspector from './edge/EdgeInspector';
import EdgeV2Inspector from './edgeV2/EdgeV2Inspector';
import GodaInspector from './goda/GodaInspector';
import GrlInspector from './grl/GrlInspector';
import IstardtInspector from './istardt/IstardtInspector';
import MutroseInspector from './mutrose/MutroseInspector';
import SleecInspector from './sleec/SleecInspector';
import Tropos4asInspector from './tropos4as/Tropos4asInspector';
import CgmInspector from './cgm/CgmInspector';

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
  switch (wb.mode) {
    case 'pistar':
    case 'pistarext':
    case 'kaos':
    case 'nfr':
    case 'kaosdoc':
    case 'kaosprop':
    case 'nfrprop':
      return null;
    case 'edge':
      return <EdgeInspector />;
    case 'edgev2':
      return <EdgeV2Inspector />;
    case 'sleec':
      return <SleecInspector />;
    case 'mutrose':
      return <MutroseInspector />;
    case 'goda':
      return <GodaInspector />;
    case 'grl':
      return <GrlInspector />;
    case 'istardt':
      return <IstardtInspector />;
    case 'tropos4as':
      return <Tropos4asInspector />;
    case 'cgm':
      return <CgmInspector />;
  }
}
