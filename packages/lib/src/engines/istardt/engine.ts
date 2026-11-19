import { onGraph, optionOr } from '../run';
import { istardtProblems } from './checks';
import { istardtAnalysisModel } from './mapper';
import { readIstardtModel } from './model';
import { istardtOutput } from './template';
import { defineEngine } from '../engine';
import { istardtCheckRegistry } from './checks';
import { istardt } from './definition';
import { istardtEngineMapper } from './mapper';
import { istardtOptions } from './options';

/**
 * iStar-DT, as the workbench registers it (goal-controller#119): the
 * DT-Golog program dtx2dtg writes, its models declaring its dialect's
 * extension's kinds.
 */
export const istardtEngine = defineEngine({
  id: 'istardt',
  help: "iStar-DT: the DT-Golog program (Prolog) dtx2dtg writes, for DT-Golog's solver and dtg2sim's RL environment",
  dialect: istardt,
  checks: istardtCheckRegistry,
  mapper: istardtEngineMapper,
  // the model as a graph: its effects, conditions and precedences are links
  // and kinds goal-tree's tree doesn't keep (#125)
  run: onGraph({
    generate: (model, { modelName, options }) =>
      istardtOutput(istardtAnalysisModel(model), {
        modelName,
        continuous: optionOr(options, 'continuous', true),
      }),
    // what crosses the extension's kinds, which no property check sees (#117 D7)
    problems: (model) =>
      istardtProblems(readIstardtModel(istardtAnalysisModel(model))),
  }),
  // the decision-theoretic Golog program; Prolog is highlighted as text
  // where its keys are declared and read (the inspector's hint)
  keysAt: {
    file: 'packages/lib/src/engines/istardt/definition.ts',
    lists: {
      goal: 'properties.goal',
      task: 'properties.task',
      quality: 'properties.quality',
    },
    mapper: 'packages/lib/src/engines/istardt/mapper.ts',
  },
  output: { label: 'DT-Golog', extension: 'pl', language: 'text' },
  outputs: [{ id: 'dtgolog', language: 'prolog' }],
  options: istardtOptions,
  fileKinds: true,
});
