/**
 * kaoslts (goal-controller#209): a KAOS operation model as FSP for LTSA,
 * and the completeness of its operationalisations.
 *
 * - mapper.ts: how goal-tree reads a KAOS model for it (its IR)
 * - operations.ts: the operation model, its conditions read as LTL
 * - completeness.ts: FSE'02's completeness, decided for Immediate Achieve
 * - fsp.ts: KAOS2LTSA's five steps, the FSP model
 * - template.ts: its files
 * - engine.ts: its registration
 */
export {
  kaosltsEngineMapper,
  kaosltsGoalModel,
  type KaosltsGoalModel,
} from './mapper';
export {
  conditionOf,
  operationModelOf,
  REQUIRED_KINDS,
  type Condition,
  type Operation,
  type OperationAgent,
  type OperationModel,
  type Operationalisation,
  type RequiredKind,
  type Requirement,
  type StateVariable,
} from './operations';
export {
  immediateAchieve,
  INCOMPLETE,
  operationalisationCompleteness,
  operationalisationProblems,
  stateFormula,
  type CompletenessVerdict,
  type StateFormula,
} from './completeness';
export {
  actionName,
  ltsModel,
  processName,
  type Fluent,
  type FspAgent,
  type FspConstraint,
  type FspDefinition,
  type FspTickProcess,
  type LtsModel,
} from './fsp';
export { completenessReport, kaosltsOutput, SYSTEM_PROCESS } from './template';
export { kaosltsEngine } from './engine';
