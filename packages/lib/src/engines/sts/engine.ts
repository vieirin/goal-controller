import { defineEngine } from '../engine';
import { stsCheckRegistry } from './checks';
import { sts } from './definition';
import { stsAnalyses } from './index';
import { stsAnalysisModel, stsEngineMapper } from './mapper';

/**
 * STS-ml, as the workbench registers it (goal-controller#163): an analysis
 * engine (its findings listed and drawn on the model; no file), its models
 * declaring its dialect's kinds (information, events, the relationships).
 */
export const stsEngine = defineEngine({
  id: 'sts',
  help: 'STS-ml (DKE 2015): security requirements over the social, information and authorisation views of a socio-technical system',
  dialect: sts,
  checks: stsCheckRegistry,
  mapper: stsEngineMapper,
  output: { label: 'Findings', extension: 'txt', language: 'text' },
  analyses: stsAnalyses,
  analysisModel: stsAnalysisModel,
  // its models declare its dialect's kinds (information, events, relationships)
  fileKinds: true,
});
