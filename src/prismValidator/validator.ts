import type { GoalTree } from '../GoalTree/types';
import { calculateExpectedElements } from './expectedElements';
import { parsePrismModel } from './parser';
import type {
  ChangeManagerValidation,
  ElementCount,
  ElementDetails,
  ExpectedElements,
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
  goalTree: GoalTree,
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

  return {
    goals: goalValidations,
    changeManager: changeManagerValidation,
    system: systemValidation,
    summary: {
      totalExpected,
      totalEmitted,
      totalMissing,
    },
  };
};
