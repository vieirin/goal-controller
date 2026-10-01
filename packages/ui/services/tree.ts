import { parsePistar } from '@istar-ts/core';
import {
  goalView,
  type GoalView,
  type RTGrammar,
} from '@goal-controller/goal-tree';
import type { TransformEngine } from '@/lib/types';

/** The RT grammar each engine reads goal texts with (its mapper's `grammar`). */
const GRAMMAR: Record<TransformEngine, RTGrammar> = {
  edgev2: 'edgeV2',
  edge: 'edge',
  sleec: 'edge',
};

/**
 * The goal model as the workbench shows it (goal-tree's `goalView`): structure, RT ids,
 * names, notations and their constructs, read with the engine's grammar. Lenient: any
 * model that parses gets a view, problems included. Throws if `modelJson` doesn't parse.
 */
export const treeView = (
  modelJson: string,
  engine: TransformEngine,
): GoalView => {
  const model = parsePistar(modelJson);
  return goalView(model, GRAMMAR[engine]);
};
