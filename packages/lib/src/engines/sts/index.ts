/**
 * STS-ml (goal-controller#163, plan and decisions in #160): the dialect
 * (iStar 2.0 with information, events and STS-ml's relationships as the
 * `sts` extension's kinds), its checks and the rules it says of a whole
 * model (./problems), and STS-Tool's `.sts` read and written (./native).
 * The design-time analyses are #161's (./analysis); the dialect's own
 * analysis lists its findings, so the workbench shows them.
 */
import { defineAnalyses } from '../analysis';
import { sts } from './definition';
import { stsSecurityAnalyses } from './analysis';
import { stsProblems } from './problems';

/** The dialect's findings as an analysis: one case, no values (#160 D-R6). */
export const stsAnalyses = defineAnalyses(sts, {
  stsDialect: {
    label: 'Dialect checks (STS-ml)',
    run: (model) => ({
      cases: [
        {
          id: 'dialect',
          label: 'Dialect checks',
          values: {},
          findings: stsProblems(model),
        },
      ],
    }),
  },
  ...stsSecurityAnalyses,
});

export { sts } from './definition';
export { stsAnalysisModel, stsEngineMapper } from './mapper';
export {
  authorisationInvalidity,
  authorisationOperations,
  operationsOverlap,
  scopeOutsideAuthorisee,
  stsCheckRegistry,
  type StsCheckName,
} from './checks';
export { stsExtension, stsMetamodelBlock } from './extension';
export { STS_PROBLEM_KINDS, stsProblems, textOf } from './problems';
export {
  canonicalSts,
  readSerializedProject,
  readSts,
  readStsProject,
  STS_LOSSY,
  stsNativeFile,
  writeSts,
  type StsContext,
  type StsProject,
} from './native';
export * from './vocabulary';
