/**
 * The lifecycle as an analysis (goal-controller#107's shape): a case per
 * scenario, run step by step (#137's step series), each step every goal's
 * state and the rule that put it there drawn on it, and the failures that
 * occurred; the case's values are its last step's. A model whose problems
 * include an error is not run.
 */
import type {
  AnalysisCase,
  AnalysisModel,
  AnalysisStep,
  AnalysisResult,
  AnalysisValue,
} from '../../analysis';
import { readTropos4asModel } from '../model';
import { tropos4asProblems } from '../problems';
import { readScenarios, type Scenario } from '../scenarios';
import { STATE_LABELS, type GoalState } from '../vocabulary';
import { runLifecycle, type GoalStatus } from './run';

/** A run with no scenario: one step, nothing believed, nothing returned. */
const NO_SCENARIO: Scenario = {
  path: '',
  label: 'No scenario',
  steps: [{ label: 'start', beliefs: {}, outcomes: {} }],
};

const shown = ({ state, rule }: GoalStatus): AnalysisValue =>
  state === 'success' || state === 'failed'
    ? {
        value: state,
        label: `dropped: ${state} [${rule}]`,
        ...(state === 'failed' && { severity: 'warning' as const }),
      }
    : {
        value: state,
        label: `${STATE_LABELS[state as GoalState]} [${rule}]`,
        ...(state === 'AF' && { severity: 'warning' as const }),
      };

export const runLifecycleAnalysis = (
  model: AnalysisModel,
  resource: Readonly<Record<string, string>> = {},
): AnalysisResult => {
  const tropos = readTropos4asModel(model);
  const errors = tropos4asProblems(tropos).filter(
    (problem) => problem.severity === 'error',
  );
  if (errors.length)
    throw new Error(errors.map((problem) => problem.message).join('; '));
  const { scenarios } = readScenarios(
    Object.entries(resource).map(([path, text]) => ({ path, text })),
  );
  return {
    cases: (scenarios.length ? scenarios : [NO_SCENARIO]).map(
      (scenario): AnalysisCase => {
        const run = runLifecycle(tropos, scenario);
        const steps = run.steps.map((step): AnalysisStep => ({
          label: step.label,
          values: Object.fromEntries([
            ...[...step.goals].map(([id, status]) => [
              tropos.find(id)!.pistarId,
              shown(status),
            ]),
            ...[...step.failures].map((id) => [
              tropos.find(id)!.pistarId,
              {
                value: 'occurred',
                label: 'occurred',
                severity: 'warning' as const,
              },
            ]),
          ]),
        }));
        return {
          id: scenario.path || 'none',
          label: scenario.label,
          values: steps.at(-1)?.values ?? {},
          steps,
        };
      },
    ),
  };
};

export {
  runLifecycle,
  instantiationOf,
  type LifecycleRun,
  type TraceRow,
  type GoalStatus,
} from './run';
export { stateChanges, traceText } from './trace';
export { readCondition, type Beliefs, type Condition } from './conditions';
export {
  achieve,
  maintain,
  perform,
  type Instantiation,
  type Pair,
} from './instantiations';
export {
  CONDITION_RULES,
  conditionTransition,
  decompositionEnd,
  deliberation,
  mayAdopt,
  nextTransition,
  subgoalTransition,
  type GoalInstance,
  type Transition,
} from './architecture';
