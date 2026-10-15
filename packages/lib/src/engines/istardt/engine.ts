import { defineEngine } from '../engine';
import { istardtCheckRegistry } from './checks';
import { istardt } from './definition';
import { istardtExtension } from './extension';
import { istardtEngineMapper } from './mapper';
import { istardtOptions } from './options';

/**
 * iStar-DT, as the workbench registers it (goal-controller#119): the
 * DT-Golog program dtx2dtg writes, its models declaring the `istardt`
 * extension's kinds.
 */
export const istardtEngine = defineEngine({
  id: 'istardt',
  help: "iStar-DT: the DT-Golog program (Prolog) dtx2dtg writes, for DT-Golog's solver and dtg2sim's RL environment",
  dialect: istardt,
  checks: istardtCheckRegistry,
  mapper: istardtEngineMapper,
  // the decision-theoretic Golog program; Prolog is highlighted as text
  output: { label: 'DT-Golog', extension: 'pl', language: 'text' },
  outputs: [{ id: 'dtgolog', language: 'prolog' }],
  options: istardtOptions,
  extension: istardtExtension,
  fileKinds: true,
});
