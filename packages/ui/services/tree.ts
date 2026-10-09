import {
  goalView,
  type GoalView,
  type RTGrammar,
} from '@goal-controller/goal-tree';
import type { TransformEngine } from '@/lib/types';
import { notationDefinitionOf } from '@/lib/workbench/definitions';
import { parseModel } from '@/lib/workbench/dialects';

/** The RT grammar each engine reads goal texts with: its definition's (SLEEC: Edge's). */
const grammarOf = (engine: TransformEngine): RTGrammar =>
  notationDefinitionOf(engine).grammar;

/**
 * The goal model as the workbench shows it (goal-tree's `goalView`): structure, RT ids,
 * names, notations and their constructs, read with the engine's grammar. Lenient: any
 * model that parses gets a view, problems included. Throws if `modelJson` doesn't parse.
 */
export const treeView = (
  modelJson: string,
  engine: TransformEngine,
): GoalView => {
  const model = parseModel(modelJson);
  return goalView(model, grammarOf(engine));
};
