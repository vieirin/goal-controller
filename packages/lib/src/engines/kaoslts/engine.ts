import { kaos } from '../../dialects/kaos';
import { defineEngine } from '../engine';
import { kaosltsEngineMapper } from './mapper';

/**
 * kaoslts, as the workbench registers it (goal-controller#209): a KAOS
 * model's operations as FSP for LTSA (KAOS2LTSA's derivation, ASE'08 §4),
 * read in the `kaos` dialect, and whether its operationalisations are
 * complete (FSE'02 Def. 3).
 */
export const kaosltsEngine = defineEngine({
  id: 'kaoslts',
  label: 'KAOS LTS (FSP)',
  help: "The operation model as FSP for LTSA, KAOS2LTSA's derivation: fluents, domain and required conditions as constraints, one composition per agent and the system; and each requirement's operationalisation checked for completeness",
  dialect: kaos,
  mapper: kaosltsEngineMapper,
  output: { label: 'FSP for LTSA', extension: 'lts', language: 'text' },
  // and one file per agent, `agent-<id>`
  outputs: [
    { id: 'system', language: 'text' },
    { id: 'completeness', language: 'text' },
  ],
});
