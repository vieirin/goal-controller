import { goalView, type GoalView } from '@goal-controller/goal-tree';
import type { AnyModel } from '@goal-controller/lib';
import type { TransformEngine } from '@/lib/types';
import {
  FRAMEWORK_ENGINE_DIALECTS,
  isFrameworkEngine,
  notationDefinitionOf,
} from '@/lib/workbench/engineDialects';

/**
 * The goal model as the workbench shows it (goal-tree's `goalView`): structure, RT ids,
 * names, notations and their constructs, read in the engine's dialect. Lenient: any
 * model gets a view, problems included.
 */
export const treeView = (model: AnyModel, engine: TransformEngine): GoalView =>
  // goal-tree reads goal texts in the engine's dialect (SLEEC's view: Edge's;
  // a framework's engine's, its framework's lines, goal-controller#171)
  goalView(
    model,
    isFrameworkEngine(engine)
      ? FRAMEWORK_ENGINE_DIALECTS[engine]
      : notationDefinitionOf(engine),
  );
