/**
 * The lifecycle as an analysis (goal-controller#107's shape): each
 * scenario run on the model, a case per step, each goal's state and the
 * rule that put it there drawn on it; a failure that occurred, too. A
 * model whose problems include an error is not run.
 */
import type {
  AnalysisCase,
  AnalysisModel,
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
    cases: (scenarios.length ? scenarios : [NO_SCENARIO]).flatMap(
      (scenario): AnalysisCase[] => {
        const run = runLifecycle(tropos, scenario);
        return run.steps.map((step, i) => ({
          id: `${scenario.path}#${i + 1}`,
          label: `${scenario.label}, step ${i + 1}: ${step.label}`,
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
