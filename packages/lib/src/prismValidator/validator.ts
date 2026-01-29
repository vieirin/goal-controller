import { GoalTree } from '@goal-controller/goal-tree';
import type { EdgeGoalTree } from '../templateEngine/edgeTypes';

type GoalTreeType = EdgeGoalTree;
import { calculateExpectedElements } from './expectedElements';
import { parsePrismModel } from './parser';
import type {
  ChangeManagerValidation,
  ElementCount,
  ElementDetails,
  ExpectedElements,
  GoalTypeCounts,
  GoalValidation,
  ParsedPrismModel,
  SystemValidation,
  ValidationReport,
} from './types';

const createElementCount = (
  expected: string[],
  emitted: string[],
): ElementCount & { details: ElementDetails } => {
  const emittedSet = new Set(emitted);
  const missing = expected.filter((item) => !emittedSet.has(item));

  return {
    expected: expected.length,
    emitted: emitted.length,
    missing: missing.length,
    details: {
      expected,
      emitted: Array.from(emittedSet),
      missing,
    },
  };
};

const validateGoal = (
  goalId: string,
  expected: {
    variables: string[];
    transitions: string[];
    formulas: string[];
    contextVariables: string[];
  },
  parsedModel: ParsedPrismModel,
): GoalValidation => {
  const goalModule = parsedModel.goalModules.get(goalId);
  const emittedVariables = goalModule?.variables.map((v) => v.name) || [];
  const emittedTransitions = goalModule?.transitions.map((t) => t.label) || [];
  // Filter formulas that belong to this goal
  // Formulas are named like: G1_achievable, G1_achieved_maintain
  // We need to match formulas that start with goalId + '_' to avoid matching
  // G10, G11, etc. when looking for G1
  const emittedFormulas = parsedModel.formulas
    .filter((f) => f.name === goalId || f.name.startsWith(`${goalId}_`))
    .map((f) => f.name);

  // Check if module exists
  const moduleExists = goalModule !== undefined;

  // Validate variables
  const variables = createElementCount(expected.variables, emittedVariables);

  // Validate transitions
  const transitions = createElementCount(
    expected.transitions,
    emittedTransitions,
  );

  // Validate formulas
  const formulas = createElementCount(expected.formulas, emittedFormulas);

  // Validate context variables: count only those that appear in the first pursue line
  // The first pursue line is the one where the goal pursues itself: [pursue_${goalId}] ...
  const pursueTransition = goalModule?.transitions.find(
    (t) => t.label === `pursue_${goalId}`,
  );

  // Extract context variables from the first pursue transition's guard
  // Filter out goal-specific variables (like G5_pursued, G5_achieved, etc.)
  const systemContextVars =
    parsedModel.systemModule?.variables.map((v) => v.name) || [];
  const goalVariablePattern = new RegExp(
    `^${goalId}_(pursued|achieved|chosen|failed)$`,
  );

  const emittedContextVars =
    pursueTransition?.variablesReferenced.filter(
      (varName) =>
        systemContextVars.includes(varName) &&
        !goalVariablePattern.test(varName),
    ) || [];

  const contextVariables = createElementCount(
    expected.contextVariables,
    emittedContextVars,
  );

  return {
    module: {
      expected: 1,
      emitted: moduleExists ? 1 : 0,
      missing: moduleExists ? 0 : 1,
      lineCount: goalModule?.lineCount,
    },
    variables,
    transitions,
    formulas,
    contextVariables,
  };
};

const validateChangeManager = (
  expected: ExpectedElements['changeManager'],
  parsedModel: ParsedPrismModel,
): ChangeManagerValidation => {
  const changeManager = parsedModel.changeManagerModule;
  const emittedVariables = changeManager?.variables.map((v) => v.name) || [];
  const emittedTransitions =
    changeManager?.transitions.map((t) => t.label) || [];

  // Collect all expected task variables
  const allExpectedTaskVariables: string[] = [];
  expected.taskVariables.forEach((vars) => {
    allExpectedTaskVariables.push(...vars);
  });

  // Collect all expected task transitions
  const allExpectedTaskTransitions: string[] = [];
  expected.taskTransitions.forEach((transitions) => {
    allExpectedTaskTransitions.push(...transitions);
  });

  return {
    taskVariables: createElementCount(
      allExpectedTaskVariables,
      emittedVariables,
    ),
    taskTransitions: createElementCount(
      allExpectedTaskTransitions,
      emittedTransitions,
    ),
  };
};

const validateSystem = (
  expected: ExpectedElements['system'],
  parsedModel: ParsedPrismModel,
): SystemValidation => {
  const system = parsedModel.systemModule;
  const emittedVariables = system?.variables.map((v) => v.name) || [];

  // Separate context and resource variables from emitted
  // Context variables are boolean, resources can be boolean or int
  // We'll check by name matching since we know the resource IDs
  const emittedContextVars: string[] = [];
  const emittedResourceVars: string[] = [];

  emittedVariables.forEach((varName) => {
    if (expected.resourceVariables.includes(varName)) {
      emittedResourceVars.push(varName);
    } else if (expected.contextVariables.includes(varName)) {
      emittedContextVars.push(varName);
    }
  });

  return {
    contextVariables: createElementCount(
      expected.contextVariables,
      emittedContextVars,
    ),
    resourceVariables: createElementCount(
      expected.resourceVariables,
      emittedResourceVars,
    ),
  };
};

export const validatePrismModel = (
  goalTree: GoalTreeType,
  prismModel: string,
): ValidationReport => {
  const parsedModel = parsePrismModel(prismModel);
  const expected = calculateExpectedElements(goalTree);

  // Validate goals
  const goalValidations = new Map<string, GoalValidation>();
  expected.goals.forEach((expectedElements, goalId) => {
    goalValidations.set(
      goalId,
      validateGoal(goalId, expectedElements, parsedModel),
    );
  });

  // Validate ChangeManager
  const changeManagerValidation = validateChangeManager(
    expected.changeManager,
    parsedModel,
  );

  // Validate System
  const systemValidation = validateSystem(expected.system, parsedModel);

  // Calculate goal type counts
  const goalTypes: GoalTypeCounts = {
    choice: { expected: 0, emitted: 0, missing: 0 },
    degradation: { expected: 0, emitted: 0, missing: 0 },
    sequence: { expected: 0, emitted: 0, missing: 0 },
    interleaved: { expected: 0, emitted: 0, missing: 0 },
    alternative: { expected: 0, emitted: 0, missing: 0 },
    basic: { expected: 0, emitted: 0, missing: 0 },
  };

  // Count expected goal types from GoalTree
  const allGoalsMapResult = GoalTree.allGoalsMap(goalTree);
  allGoalsMapResult.forEach((goal) => {
    const goalType =
      goal.properties.engine.executionDetail?.type === 'choice'
        ? 'choice'
        : goal.properties.engine.executionDetail?.type === 'degradation'
          ? 'degradation'
          : goal.properties.engine.executionDetail?.type === 'sequence'
            ? 'sequence'
            : goal.properties.engine.executionDetail?.type === 'interleaved'
              ? 'interleaved'
              : goal.properties.engine.executionDetail?.type === 'alternative'
                ? 'alternative'
                : 'basic';
    goalTypes[goalType].expected++;
  });

  // Count emitted goal types from parsed PRISM model
  parsedModel.goalModules.forEach((module) => {
    if (module.goalType) {
      goalTypes[module.goalType].emitted++;
    }
  });

  // Calculate missing for each type
  Object.keys(goalTypes).forEach((type) => {
    const typed = type as keyof GoalTypeCounts;
    goalTypes[typed].missing = Math.max(
      0,
      goalTypes[typed].expected - goalTypes[typed].emitted,
    );
  });

  // Calculate summary
  let totalExpected = 0;
  let totalEmitted = 0;
  let totalMissing = 0;

  goalValidations.forEach((validation) => {
    totalExpected +=
      validation.module.expected +
      validation.variables.expected +
      validation.transitions.expected +
      validation.formulas.expected +
      validation.contextVariables.expected;
    totalEmitted +=
      validation.module.emitted +
      validation.variables.emitted +
      validation.transitions.emitted +
      validation.formulas.emitted +
      validation.contextVariables.emitted;
    totalMissing +=
      validation.module.missing +
      validation.variables.missing +
      validation.transitions.missing +
      validation.formulas.missing +
      validation.contextVariables.missing;
  });

  totalExpected +=
    changeManagerValidation.taskVariables.expected +
    changeManagerValidation.taskTransitions.expected;
  totalEmitted +=
    changeManagerValidation.taskVariables.emitted +
    changeManagerValidation.taskTransitions.emitted;
  totalMissing +=
    changeManagerValidation.taskVariables.missing +
    changeManagerValidation.taskTransitions.missing;

  totalExpected +=
    systemValidation.contextVariables.expected +
    systemValidation.resourceVariables.expected;
  totalEmitted +=
    systemValidation.contextVariables.emitted +
    systemValidation.resourceVariables.emitted;
  totalMissing +=
    systemValidation.contextVariables.missing +
    systemValidation.resourceVariables.missing;

  // Calculate node-type aggregated summary
  const allGoalsList = GoalTree.allByType(goalTree, 'goal');
  const goalsModulesExpected = allGoalsList.length;
  const goalsModulesEmitted = parsedModel.goalModules.size;

  return {
    goals: goalValidations,
    changeManager: changeManagerValidation,
    system: systemValidation,
    goalTypes,
    summary: {
      totalExpected,
      totalEmitted,
      totalMissing,
      byNodeType: {
        goals: {
          modules: {
            expected: goalsModulesExpected,
            emitted: goalsModulesEmitted,
          },
        },
        tasks: {
          variables: {
            expected: changeManagerValidation.taskVariables.expected,
            emitted: changeManagerValidation.taskVariables.emitted,
          },
          transitions: {
            expected: changeManagerValidation.taskTransitions.expected,
            emitted: changeManagerValidation.taskTransitions.emitted,
          },
        },
        resources: {
          variables: {
            expected: systemValidation.resourceVariables.expected,
            emitted: systemValidation.resourceVariables.emitted,
          },
        },
      },
    },
  };
};
