import { runOf } from '@goal-controller/lib';
import { GoalModel } from './goalModel';
import { KNOWN_PROPERTIES } from '../lib/models/knownProperties';
import type { TransformEngine } from '../lib/types';
import { nodeIdInMessage } from '../lib/workbench/localProblems';
import {
  SOURCE,
  type AnalyzeResponse,
  type Problem,
} from '../lib/workbench/types';
import { ENGINE_LABEL, engineOf } from '../lib/workbench/engineDialects';

/**
 * { modelJson, engine } → engine-specific variables (with the nodes that use them),
 * problems, and the custom properties the engine reads. A parse failure is reported as
 * a problem, not thrown. The model is read as its engine reads it (its `run`):
 * through its mapper, its own IR, or as a graph (an analysis engine's;
 * iStar-DT's, whose writer reads its kinds and links, not a tree).
 */
export const analyze = (
  modelJson: string,
  engine: TransformEngine,
): AnalyzeResponse => {
  const definition = engineOf(engine);
  const run = runOf(definition);
  const parsed = GoalModel.parseFor(definition, modelJson);

  const response: AnalyzeResponse = {
    success: true,
    variables: [],
    problems: [],
    knownProperties: KNOWN_PROPERTIES[engine],
  };

  if (!parsed.success) {
    const problem: Problem = {
      severity: 'error',
      // the file, the model's structure, or the engine's reading of it
      source:
        parsed.stage === 'parse'
          ? SOURCE.file
          : parsed.stage === 'validate'
            ? SOURCE.workbench
            : ENGINE_LABEL[engine],
      message: parsed.error,
      elementId: nodeIdInMessage(parsed.error),
    };
    response.problems.push(problem);
    return response;
  }

  const reading = parsed.reading as never;
  // what the engine finds wrong across elements, which no property check sees
  for (const problem of run.problems?.(reading, parsed.model) ?? []) {
    const elementId = problem.elementInMessage
      ? nodeIdInMessage(problem.message)
      : problem.element;
    response.problems.push({
      severity: problem.severity,
      source: ENGINE_LABEL[engine],
      message: problem.message,
      ...((problem.elementInMessage || elementId) && { elementId }),
    });
  }
  // the variables its output leaves open (the Edge engines')
  if (run.variables) response.variables = run.variables(reading);

  return response;
};
