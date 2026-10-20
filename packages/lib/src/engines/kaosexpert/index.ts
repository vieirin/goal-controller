/**
 * kaosexpert (goal-controller#190): Cailliau and van Lamsweerde's handling
 * of knowledge uncertainty in obstacle analysis (RE'15), an analysis
 * engine over kaosprop's dialect.
 *
 * - definition.ts: its dialect (per-expert and distribution estimates;
 *   experts and calibration variables as project resources, resources.ts)
 * - cooke.ts: Cooke's classical model, as RE'15 applies it
 * - propagation.ts: the BDDs, the Monte Carlo, VU and US; the critical
 *   obstacles
 * - mapper.ts: how goal-tree reads a KAOS model for it
 */
import { defineAnalyses } from '../analysis';
import { projectResourceParsers } from '../projectResources';
import { kaosexpert } from './definition';
import { runCriticalObstacles, runUncertainty } from './propagation';
import { parseCalibrations, parseEvidence, parseExperts } from './resources';

export const kaosexpertAnalyses = defineAnalyses(kaosexpert, {
  uncertainty: {
    label: 'Satisfaction uncertainty',
    inputs: ['expert', 'calibration'],
    run: runUncertainty,
  },
  criticalObstacles: {
    label: 'Critical obstacles',
    inputs: ['expert', 'calibration'],
    run: runCriticalObstacles,
  },
});

export const kaosexpertProjectResourceParsers = projectResourceParsers(
  kaosexpert,
)({
  expert: parseExperts,
  calibration: parseCalibrations,
  evidence: parseEvidence,
});

export { kaosexpert } from './definition';
export {
  cooke,
  WEIGHTINGS,
  type CookeInput,
  type CookeResult,
  type CookeVariable,
  type ExpertScore,
  type Weighting,
} from './cooke';
export {
  criticalObstacles,
  DEFAULT_EXPERT_OPTIONS,
  distributionOfSamples,
  expertAnalysis,
  REPORTED_QUANTILES,
  runCriticalObstacles,
  runUncertainty,
  satisfactionUncertainty,
  simulate,
  uncertaintySpread,
  type CriticalObstacle,
  type ExpertAnalysis,
  type ExpertOptions,
} from './propagation';
export {
  CALIBRATIONS_PATH,
  EVIDENCE_PATH,
  EXPERTS_PATH,
  parseCalibrations,
  parseEvidence,
  parseExperts,
  quantileLevelsOf,
  readCalibrations,
  readEvidence,
  readExperts,
  type CalibrationEntry,
  type CalibrationsFile,
  type EvidenceEntry,
  type EvidenceFile,
  type ExpertEntry,
  type ExpertsFile,
} from './resources';
export { kaosexpertAnalysisModel, kaosexpertEngineMapper } from './mapper';
export { kaosexpertOptions } from './options';
