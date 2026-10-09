import { goalView, type GoalView } from '@goal-controller/goal-tree';
import type { TransformEngine } from '@/lib/types';
import { notationDefinitionOf } from '@/lib/workbench/engineDialects';
import { parseModel } from '@/lib/workbench/dialects';

/**
 * The goal model as the workbench shows it (goal-tree's `goalView`): structure, RT ids,
 * names, notations and their constructs, read in the engine's dialect. Lenient: any
 * model that parses gets a view, problems included. Throws if `modelJson` doesn't parse.
 */
export const treeView = (
  modelJson: string,
  engine: TransformEngine,
): GoalView => {
  // read with the dialect it records, if any (the view leaves its kinds out)
  const model = parseModel(modelJson);
  // goal-tree reads goal texts in the engine's dialect (SLEEC's view: Edge's)
  return goalView(model, notationDefinitionOf(engine));
};
