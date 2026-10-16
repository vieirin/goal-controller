/**
 * STS-ml's design-time analyses (goal-controller#161): well-formedness,
 * security and threats, and the security requirements a model derives,
 * as #160 item 1 defines them from the published sources. Each analysis
 * gives one case of findings. `runStsAnalyses` is what `scripts/sts-stress`
 * calls and compares with a seed's `expected-analyses.json` (#160 D-G12).
 */
import type {
  Analyses,
  AnalysisCase,
  AnalysisModel,
  AnalysisResult,
} from '../../analysis';
import type { StsFinding } from './findings';
import { indexStsModel } from './graph';
import { readStsModel } from './read';
import { securityRequirements, type StsRequirement } from './requirements';
import { securityAnalysis } from './security';
import { threatAnalysis } from './threats';
import { wellFormednessAnalysis } from './wellformedness';

export type { StsFinding } from './findings';
export type { StsModel } from './model';
export type { StsRequirement } from './requirements';
export { readStsModel, STS_ANALYSIS_KINDS } from './read';
export { indexStsModel } from './graph';
export {
  securityRequirements,
  ALL_AGENTS,
  ORGANISATION,
  SYSTEM,
} from './requirements';
export { securityAnalysis, authorisationConflicts } from './security';
export { threatAnalysis } from './threats';
export { wellFormednessAnalysis } from './wellformedness';

export type StsAnalysisId = 'wellFormedness' | 'security' | 'threats';

export const STS_ANALYSIS_LABELS: Readonly<Record<StsAnalysisId, string>> = {
  wellFormedness: 'Well-formedness analysis',
  security: 'Security analysis',
  threats: 'Threat analysis',
};

export type StsAnalyses = {
  findings: Readonly<Record<StsAnalysisId, readonly StsFinding[]>>;
  requirements: readonly StsRequirement[];
};

/** Every analysis and the derived requirements, on the dialect's model. */
export const runStsAnalyses = (model: AnalysisModel): StsAnalyses => {
  const index = indexStsModel(readStsModel(model));
  return {
    findings: {
      wellFormedness: wellFormednessAnalysis(index),
      security: securityAnalysis(index),
      threats: threatAnalysis(index),
    },
    requirements: securityRequirements(index),
  };
};

/** One analysis as the workbench reads it: a case of its findings. */
export const stsAnalysisResult = (
  id: StsAnalysisId,
  model: AnalysisModel,
): AnalysisResult => {
  const index = indexStsModel(readStsModel(model));
  const findings =
    id === 'wellFormedness'
      ? wellFormednessAnalysis(index)
      : id === 'security'
        ? securityAnalysis(index)
        : threatAnalysis(index);
  const result: AnalysisCase = {
    id,
    label: STS_ANALYSIS_LABELS[id],
    values: {},
    findings,
  };
  return { cases: [result] };
};

/** The three analyses, for the engine's `stsAnalyses` (red's `../index`) to spread. */
export const stsSecurityAnalyses = {
  wellFormedness: {
    label: STS_ANALYSIS_LABELS.wellFormedness,
    run: (model: AnalysisModel) => stsAnalysisResult('wellFormedness', model),
  },
  security: {
    label: STS_ANALYSIS_LABELS.security,
    run: (model: AnalysisModel) => stsAnalysisResult('security', model),
  },
  threats: {
    label: STS_ANALYSIS_LABELS.threats,
    run: (model: AnalysisModel) => stsAnalysisResult('threats', model),
  },
} as const satisfies Analyses;
