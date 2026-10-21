/**
 * kaossim's analyses as results (goal-controller#193): the simulation, one
 * case per design (its objective functions on their goals, its quality
 * variables' distributions; the design drawn as a selection, #152), and the
 * design-space search, one case per Pareto-optimal design. A case's steps
 * are its report: what can't be read, then each objective function.
 */
import { distributionOfSamples } from '../../numeric/samples';
import type {
  AnalysisCase,
  AnalysisContext,
  AnalysisModel,
  AnalysisResult,
  AnalysisStep,
  AnalysisValue,
} from '../analysis';
import { readDesigns } from './designs';
import { quantitativeModel, type QuantitativeModel } from './model';
import { simOptionsOf } from './options';
import { searchDesigns } from './search';
import {
  enumerateDesigns,
  simulateDesign,
  type DesignChoice,
  type DesignRun,
  type DrawCache,
  type ObjectiveValue,
} from './simulation';

/** At most this many designs are simulated as cases when the project lists none. */
export const SIMULATED_CASES = 256;

const digits = (x: number) =>
  Math.abs(x) >= 1000 || Number.isInteger(x)
    ? String(Math.round(x))
    : String(Math.round(x * 1000) / 1000);
const percent = (p: number) => `${(Math.round(p * 1000) / 10).toFixed(1)}%`;

/** An objective's value as people read it: `8MinRespRate 47.1% (target 50%)`. */
export const objectiveText = (value: ObjectiveValue): string => {
  const { objective } = value;
  const shown = objective.def.measure === 'probability' ? percent : digits;
  const target =
    objective.target !== undefined
      ? ` (target ${shown(objective.target)})`
      : '';
  return 'missing' in value
    ? `${objective.name}: needs ${value.missing.join(', ')}`
    : `${objective.name} ${shown(value.value)} ± ${shown(value.stderr)}${target}`;
};

/** Whether an objective's value misses its target (Max: below it; Min: above). */
const missesTarget = (value: ObjectiveValue) =>
  !('missing' in value) &&
  value.objective.target !== undefined &&
  (value.objective.modal === 'Max'
    ? value.value < value.objective.target
    : value.value > value.objective.target);

/** A design's run as a case: a value on each goal it keeps, its selection, its report. */
export const caseOf = (
  model: QuantitativeModel,
  run: DesignRun,
  id: string = run.design.id,
): AnalysisCase => {
  const values: Record<string, AnalysisValue> = {};
  for (const goal of run.active.goals) {
    const objectives = run.objectives.filter((o) => o.objective.goal === goal);
    const variables = [...model.variables.values()].filter(
      (v) => v.goal === goal,
    );
    const first = variables.find((v) => run.samples.has(v.name));
    const distribution = first
      ? distributionOfSamples(run.samples.get(first.name)!)
      : undefined;
    if (objectives.length) {
      const resolved = objectives.find((o) => !('missing' in o));
      values[goal] = {
        value:
          resolved && !('missing' in resolved) ? resolved.value : 'unresolved',
        label: objectives.map(objectiveText).join(' · '),
        ...(objectives.some((o) => 'missing' in o || missesTarget(o)) && {
          severity: 'warning' as const,
        }),
        ...(distribution && { distribution }),
      };
      continue;
    }
    if (!variables.length) continue;
    const lacking = variables.flatMap((v) => run.missing.get(v.name) ?? []);
    values[goal] = first
      ? {
          value: distribution!.mean,
          label: `${first.name}: mean ${digits(distribution!.mean)}${lacking.length ? ` · needs ${[...new Set(lacking)].join(', ')}` : ''}`,
          distribution: distribution!,
          ...(lacking.length && { severity: 'warning' as const }),
        }
      : {
          value: 'unresolved',
          label: `needs ${[...new Set(lacking)].join(', ')}`,
          severity: 'warning',
        };
  }
  const steps: AnalysisStep[] = [
    ...[...model.problems, ...run.problems].map((label) => ({
      label,
      values: {},
    })),
    ...run.objectives.map((o) => ({ label: objectiveText(o), values })),
  ];
  return {
    id,
    label: run.design.name,
    values,
    selection: run.active.selection,
    summary:
      run.objectives.map(objectiveText).join('; ') || 'no objective function',
    ...(steps.length && { steps }),
  };
};

/** The designs the project lists, or (none listed) every design, up to SIMULATED_CASES. */
const designsOf = (
  model: QuantitativeModel,
  context?: AnalysisContext,
): DesignChoice[] => {
  const files = Object.entries(context?.resources?.design ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, text]) => ({ path, text }));
  const listed = readDesigns(files).designs;
  return listed.length
    ? listed
    : enumerateDesigns(model, SIMULATED_CASES).designs;
};

/** Each design, simulated: a case per design. */
export const runSimulation = (
  view: AnalysisModel,
  _resource?: Readonly<Record<string, string>>,
  context?: AnalysisContext,
): AnalysisResult => {
  const model = quantitativeModel(view);
  const options = simOptionsOf(context);
  const cache: DrawCache = new Map();
  return {
    cases: designsOf(model, context).map((design) =>
      caseOf(model, simulateDesign(model, design, options, cache)),
    ),
  };
};

/** The Pareto-optimal designs: a case per design on the front, the search's account first. */
export const runDesignSpace = (
  view: AnalysisModel,
  _resource?: Readonly<Record<string, string>>,
  context?: AnalysisContext,
): AnalysisResult => {
  const model = quantitativeModel(view);
  const options = simOptionsOf(context);
  const result = searchDesigns(model, options);
  const unranked = result.evaluated.filter((s) => s.scores === null).length;
  const how =
    result.method === 'nsga2'
      ? `NSGA-II, population ${options.population}, ${options.generations} generations, seed ${options.seed}`
      : `every design${result.complete ? '' : `, at most ${options.limit} (the space is larger: not exact)`}`;
  const account = `${result.evaluated.length} designs evaluated (${how}), ${options.samples} samples each: ${result.front.length} Pareto-optimal${unranked ? `; ${unranked} with an unresolved objective, not ranked` : ''}`;
  if (!result.front.length)
    return {
      cases: [
        {
          id: 'none',
          label: 'No Pareto-optimal design',
          values: {},
          summary: account,
          steps: [account, ...model.problems].map((label) => ({
            label,
            values: {},
          })),
        },
      ],
    };
  return {
    cases: result.front.map((scored, i) => {
      const own = caseOf(model, scored.run, `pareto-${i + 1}`);
      return {
        ...own,
        label: `Pareto ${i + 1}: ${scored.run.design.name}`,
        summary: `${own.summary} (${account})`,
      };
    }),
  };
};
