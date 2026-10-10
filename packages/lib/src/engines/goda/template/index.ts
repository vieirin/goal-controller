/**
 * GODA-MDP's outputs for a goal model: the actor's PRISM MDP (`<Actor>.nm`,
 * the primary file), its four PCTL properties, the parametric reliability
 * and cost formulas, and the script that evaluates them, as the generator a
 * model's references come from writes them (`variant`, goal-controller#34
 * D10).
 */
import { GoalTree, type IStarModel } from '@goal-controller/goal-tree';
import {
  outputBaseName,
  type EngineOutput,
  type EngineOutputFile,
} from '../../output';
import { godaEngineMapper, type GodaGoalNode } from '../mapper';
import { adjustName, GodaUnsupported } from './containers';
import { sortRoots, writePrism } from './prism';
import { GODA_GENERATORS, type GodaVariant } from './variants';

export { GodaUnsupported } from './containers';
export {
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
  /** the generator version to write as (default: cc808b6) */
  variant?: GodaVariant;
};

/**
 * What GODA generates of a model (goal-tree's validated model): the files of
 * the actor that holds the selected goal. Throws GodaUnsupported for what the
 * engine doesn't generate yet (a variant, decision making, contexts, an
 * incomplete element), and an Error for a model GODA rejects.
 */
export const godaOutput = (
  model: IStarModel,
  { modelName, variant = 'cc808b6' }: GodaOutputOptions,
): EngineOutput => {
  const generator = GODA_GENERATORS[variant];
  if (!generator)
    throw new GodaUnsupported(`the ${variant} generator`, '#38, #39, #40');
  const roots = GoalTree.fromModel(model, godaEngineMapper).nodes.filter(
    (node): node is GodaGoalNode => node.type === 'goal',
  );
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
  // the actor that holds it: its root's
  const root = roots.find((r) => goalsOf(r).includes(goal!))!;
  const actorId = model.elements.get(root.iStarId)?.parent;
  const actor = actorId ? model.elements.get(actorId) : undefined;
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
      },
      // FileUtility.writeFile: println
      ...PCTL.map(([id, fileName, text]) =>
        file(id, fileName, `${text}\n`, 'pctl'),
      ),
      file('reliability', 'reliability.out', formulas.reliability, 'text'),
      file('cost', 'cost.out', formulas.cost, 'text'),
      file('evaluate', 'eval_formula.sh', prism.evalScript, 'shell'),
    ],
  };
};
