import { GoalTree } from '@goal-controller/goal-tree';
import { GoalModel } from './goalModel';
import { KNOWN_PROPERTIES } from '../lib/models/knownProperties';
import { isPrismEngine, type TransformEngine } from '../lib/types';
import {
  istardtAnalysisModel,
  istardtProblems,
  mutroseProblem,
  readIstardtModel,
  type MutroseGoalTree,
} from '@goal-controller/lib';
import { nodeIdInMessage } from '../lib/workbench/localProblems';
import {
  SOURCE,
  type AnalyzeResponse,
  type Problem,
  type VariableInfo,
} from '../lib/workbench/types';
import { ENGINE_LABEL, generatesFiles } from '../lib/workbench/engineDialects';

type WithCondition = {
  id: string;
  properties: {
    engine?: {
      execCondition?: {
        assertion?: { variables?: Array<{ name: string }> };
        maintain?: { variables?: Array<{ name: string }> };
      };
    };
  };
};

/**
 * { modelJson, engine } → engine-specific variables (with the nodes that use them),
 * problems, and the custom properties the engine reads. A parse failure is reported as
 * a problem, not thrown.
 */
/**
 * A model text read as its engine reads it: through its mapper, or as a
 * graph (an analysis engine's; iStar-DT's, whose writer reads its kinds and
 * links, not a tree).
 */
const parseFor = (modelJson: string, engine: TransformEngine) => {
  if (engine === 'edgev2') return GoalModel.parseForEdgeV2(modelJson);
  if (engine === 'sleec') return GoalModel.parseForSleec(modelJson);
  if (engine === 'mutrose') return GoalModel.parseForMutrose(modelJson);
  if (engine === 'goda') return GoalModel.parseForGoda(modelJson);
  if (engine === 'kaosdoc') return GoalModel.parseForKaosdoc(modelJson);
  if (!generatesFiles(engine) || engine === 'istardt')
    return GoalModel.parseAsGraph(modelJson);
  return GoalModel.parseForEdge(modelJson);
};

export const analyze = (
  modelJson: string,
  engine: TransformEngine,
): AnalyzeResponse => {
  const parsed = parseFor(modelJson, engine);

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

  if (engine === 'istardt' && 'model' in parsed && parsed.model) {
    // what crosses the extension's kinds, which no property check sees (#117 D7)
    for (const problem of istardtProblems(
      readIstardtModel(istardtAnalysisModel(parsed.model)),
    ))
      response.problems.push({
        severity: problem.severity,
        source: ENGINE_LABEL[engine],
        message: problem.message,
        ...(problem.element && { elementId: problem.element }),
      });
  } else if (engine === 'mutrose') {
    // what the decomposer checks across goals (variables' scope, query types)
    const problem = mutroseProblem(parsed.tree as MutroseGoalTree);
    if (problem)
      response.problems.push({
        severity: 'error',
        source: ENGINE_LABEL[engine],
        message: problem,
        elementId: nodeIdInMessage(problem),
      });
  } else if (isPrismEngine(engine)) {
    const tree = parsed.tree as Parameters<typeof GoalTree.contextVariables>[0];
    const nodes = [
      ...GoalTree.allByType(tree, 'goal'),
      ...GoalTree.allByType(tree, 'task'),
    ] as unknown as WithCondition[];
    const usedBy = (variable: string): string[] =>
      nodes
        .filter((node) => {
          const condition = node.properties.engine?.execCondition;
          return [
            ...(condition?.assertion?.variables ?? []),
            ...(condition?.maintain?.variables ?? []),
          ].some((v) => v.name === variable);
        })
        .map((node) => node.id);

    const variables: VariableInfo[] = [
      ...GoalTree.contextVariables(tree).map((name) => ({
        name,
        kind: 'context' as const,
        usedBy: usedBy(name),
      })),
      ...GoalTree.taskAchievabilityVariables(tree).map((name) => ({
        name,
        kind: 'achievability' as const,
        usedBy: [name.replace(/_achievable$/, '')],
      })),
    ];
    response.variables = variables;
  }

  return response;
};
