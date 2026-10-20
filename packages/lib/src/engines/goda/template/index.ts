/**
 * GODA-MDP's outputs for a goal model: the actor's PRISM MDP (`<Actor>.nm`,
 * the primary file), its four PCTL properties, the parametric reliability
 * and cost formulas, and the script that evaluates them, as the generator a
 * model's references come from writes them (`variant`, goal-controller#34
 * D10).
 */
import {
  GoalTree,
  modelShapeProblem,
  type ModelFor,
  type ModelOf,
} from '@goal-controller/goal-tree';
import {
  outputBaseName,
  type EngineOutput,
  type EngineOutputFile,
} from '../../output';
import { godaEngineMapper, type GodaGoalNode } from '../mapper';
import { adjustName, type Container } from './containers';
import { sortRoots, writePrism } from './prism';
import { composeRuntimeFormulas } from './runtime';
import {
  GODA_DEFAULT_VARIANT,
  GODA_GENERATORS,
  GODA_VARIANTS,
  type GodaVariant,
} from './variants';

export { GodaUnsupported } from './containers';
export {
  GODA_DEFAULT_VARIANT,
  GODA_GENERATORS,
  GODA_IMPLEMENTED_VARIANTS,
  GODA_VARIANTS,
  type GodaGenerator,
  type GodaVariant,
} from './variants';

/** RTGoreProducer's MDP properties, one file each, in the order upstream writes them. */
const PCTL = [
  ['reachability-max', 'ReachabilityMax.pctl', 'Pmax=? [ F "success" ]'],
  ['reachability-min', 'ReachabilityMin.pctl', 'Pmin=? [ F "success" ]'],
  ['cost-max', 'CostMax.pctl', 'R{"cost"}max=? [ F "success" ]'],
  ['cost-min', 'CostMin.pctl', 'R{"cost"}min=? [ F "success" ]'],
] as const;

/**
 * The MDP's name: the actor's, as AgentDefinition adjusts it, but never a
 * path (upstream would write `../x.nm` outside its folder: `/` and `\\`
 * become `_`).
 */
const fileNameOf = (actor: string): string =>
  adjustName(actor).replace(/[/\\]/g, '_');

/** Every goal of a tree, depth first. */
const goalsOf = (goal: GodaGoalNode): GodaGoalNode[] => [
  goal,
  ...(goal.children ?? []).flatMap(goalsOf),
];

export type GodaOutputOptions = {
  /** the model's file name (`and2.txt`) */
  modelName: string;
  /** the generator version to write as (default: GODA_DEFAULT_VARIANT, 5305bc1) */
  variant?: GodaVariant;
  /**
   * also write `reliability.formula` and `cost.formula`, the one-line
   * formulas SA-BSN's runtime loads (goal-controller#94; default off)
   */
  runtimeFormulas?: boolean;
};

/** The runtime's pair: the formula line only, as `DataAccess::fetch_formula` reads it (no newline). */
const runtimeFiles = (root: Container): EngineOutputFile[] => {
  const { reliability, cost } = composeRuntimeFormulas(root);
  return [
    {
      id: 'runtime-reliability',
      fileName: 'reliability.formula',
      text: reliability,
      language: 'text',
    },
    {
      id: 'runtime-cost',
      fileName: 'cost.formula',
      text: cost,
      language: 'text',
    },
  ];
};

/** The typed IR GODA reads (goal-controller#125): its actors, each with one tree. */
export type GodaGoalModel = ModelOf<typeof godaEngineMapper>;

/**
 * A model (goal-tree's validated model) as GODA reads it: its `GoalModel`.
 * Throws an Error for a model outside GODA's shape (an actor with two roots).
 */
export const godaGoalModel = <EK extends string, LK extends string>(
  model: ModelFor<typeof godaEngineMapper.dialect, EK, LK>,
): GodaGoalModel => {
  const problem = modelShapeProblem(model, godaEngineMapper.dialect);
  if (problem) throw new Error(`[INVALID_MODEL]: ${problem}`);
  return GoalTree.goalModel(model, godaEngineMapper);
};

/**
 * What GODA generates of a model (`godaGoalModel`): the files of the actor
 * that holds the selected goal, as the generator version `variant` writes
 * them (#34 D10). Throws an Error for a model GODA rejects, or a version it
 * has no generator for.
 */
export const godaOutput = (
  goalModel: GodaGoalModel,
  {
    modelName,
    variant = GODA_DEFAULT_VARIANT,
    runtimeFormulas = false,
  }: GodaOutputOptions,
): EngineOutput => {
  const generator = GODA_GENERATORS[variant];
  if (!generator)
    throw new Error(
      `GODA: no generator ${String(variant)} (the versions are ${GODA_VARIANTS.join(', ')})`,
    );
  const roots = goalModel.actors
    .flatMap((actor) => actor.trees)
    .filter((node): node is GodaGoalNode => node.type === 'goal');
  const selected = roots
    .flatMap(goalsOf)
    .filter((goal) => goal.properties.engine.selected);
  if (selected.length !== 1)
    throw new Error(
      selected.length
        ? `GODA generates from one selected goal: ${selected.map((goal) => goal.id).join(', ')} are selected`
        : 'GODA generates from the selected goal: set selected to true on one goal',
    );
  const [goal] = selected;
  // the actor that holds it: its root's (#34 D16: the IR says which)
  const root = roots.find((r) => goalsOf(r).includes(goal!))!;
  const actor = goalModel.actors.find((a) => a.trees.includes(root));
  const containers = sortRoots(
    generator.containers({ roots: [root], selected: (g) => g === goal }),
  );
  const prism = writePrism(containers, generator);
  const formulas = generator.formulas(containers[0]!);
  const file = (
    id: string,
    fileName: string,
    text: string,
    language: string,
  ): EngineOutputFile => ({ id, fileName, text, language });
  return {
    files: [
      {
        // named after the actor, as AgentDefinition names it
        ...file(
          'model',
          `${actor ? fileNameOf(actor.name) : outputBaseName(modelName)}.nm`,
          prism.model,
          'prism',
        ),
        primary: true,
        // each line's element, by piStar id: GODA's ids repeat under goals
        owners: prism.owners,
      },
      // FileUtility.writeFile: println
      ...PCTL.map(([id, fileName, text]) =>
        file(id, fileName, `${text}\n`, 'pctl'),
      ),
      file('reliability', 'reliability.out', formulas.reliability, 'text'),
      file('cost', 'cost.out', formulas.cost, 'text'),
      // 2019-07: PARAMProducer writes it (the formulas' parameters), 2019-01: PrismWriter
      file(
        'evaluate',
        'eval_formula.sh',
        formulas.evalScript ?? prism.evalScript,
        'shell',
      ),
      ...(runtimeFormulas ? runtimeFiles(containers[0]!) : []),
    ],
  };
};
