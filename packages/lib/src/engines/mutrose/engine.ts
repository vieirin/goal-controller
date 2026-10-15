import { defineEngine } from '../engine';
import { mutroseCheckRegistry } from './checks';
import { mutrose } from './definition';
import { mutroseEngineMapper } from './mapper';
import { mutrosePool } from './pool';
import { mutroseProjectResources } from './projectResources';

/** MutRoSe, as the workbench registers it: it reads the model as written (no options). */
export const mutroseEngine = defineEngine({
  id: 'mutrose',
  help: "The runtime annotation MutRoSe's decomposer reads, after checking the model as it does",
  dialect: mutrose,
  checks: mutroseCheckRegistry,
  mapper: mutroseEngineMapper,
  // the runtime annotation its decomposer prints with -v
  output: {
    label: 'Runtime annotation',
    extension: 'rannot',
    language: 'rannot',
  },
  outputs: [{ id: 'annotation', language: 'rannot' }],
  projectResources: mutroseProjectResources,
  pool: mutrosePool,
});
