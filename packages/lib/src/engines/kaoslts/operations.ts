/**
 * A KAOS model's operation model as kaoslts and the completeness check read
 * it (goal-controller#209): its requirements with their formal definitions,
 * its agents, its operations with their domain conditions and performers,
 * its operationalisations with their required conditions (FSE'02 §2.1.4),
 * and its state variables, the objects' attributes (an agent's too) with
 * their initial values. Each condition is its text and its LTL AST
 * (`parseLtl`, goal-controller#211), or why it has none.
 */
import { parseLtl, type LtlNode } from '@goal-controller/goal-language';
import type { KaosltsGoalModel } from './mapper';

/** A formula as written, read: its AST, or the parser's first error. */
export type Condition =
  | { text: string; formula: LtlNode; error: null }
  | { text: string; formula: null; error: string };

/** A formula's text read (null when unset or blank). */
export const conditionOf = (
  text: string | null | undefined,
): Condition | null => {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const { value, errors } = parseLtl(trimmed);
  return value
    ? { text: trimmed, formula: value, error: null }
    : {
        text: trimmed,
        formula: null,
        error: errors[0]?.message ?? 'does not parse',
      };
};

export type Requirement = {
  id: string;
  name: string;
  formalSpec: Condition | null;
};

export type OperationAgent = { id: string; name: string; environment: boolean };

export type Operation = {
  id: string;
  name: string;
  domPre: Condition | null;
  domPost: Condition | null;
  /** the agents performing it, in the model's order */
  performers: string[];
};

/** The required condition kinds on an operationalisation (FSE'02 Def. 2). */
export const REQUIRED_KINDS = ['ReqPre', 'ReqTrig', 'ReqPost'] as const;
export type RequiredKind = (typeof REQUIRED_KINDS)[number];

/** An operation's required conditions for one requirement: the link's. */
export type Operationalisation = {
  /** the link's piStar id */
  id: string;
  operation: string;
  requirement: string;
} & Readonly<Record<RequiredKind, Condition | null>>;

/** An attribute of an object (`sump.highWater`): a state variable. */
export type StateVariable = {
  /** the object's piStar id, as formulas name it */
  object: string;
  objectName: string;
  attribute: string;
  /** as declared: `bool`, a number, values (`On|Off`), a type's name */
  type: string;
  /** its value in the initial state, as `Initially` writes it ('' unset) */
  initially: string;
};

export type OperationModel = {
  requirements: Requirement[];
  agents: OperationAgent[];
  operations: Operation[];
  operationalisations: Operationalisation[];
  variables: StateVariable[];
};

const PERFORMANCE = 'kaosOperations.PerformanceLink';
const OPERATIONALISATION = 'kaosOperations.OperationalisationLink';

/** The operation model of a KAOS model's IR (`kaosltsGoalModel`). */
export const operationModelOf = (model: KaosltsGoalModel): OperationModel => {
  const requirements: Requirement[] = [];
  const agents: OperationAgent[] = [];
  const operations: Operation[] = [];
  const variables: StateVariable[] = [];
  for (const element of model.elements) {
    const name = element.name.trim() || element.id;
    switch (element.as) {
      case 'goal':
        requirements.push({
          id: element.id,
          name,
          formalSpec: conditionOf(element.engine.formalSpec),
        });
        break;
      case 'operation':
        operations.push({
          id: element.id,
          name,
          domPre: conditionOf(element.engine.domPre),
          domPost: conditionOf(element.engine.domPost),
          performers: model.links
            .filter(
              (link) => link.kind === PERFORMANCE && link.target === element.id,
            )
            .map((link) => link.source),
        });
        break;
      case 'agent':
      case 'object': {
        if (element.as === 'agent')
          agents.push({
            id: element.id,
            name,
            environment: element.kind === 'kaos.EnvironmentAgent',
          });
        const initially = new Map(
          element.engine.initially.map((pair) => [pair.name, pair.value]),
        );
        for (const { name: attribute, value: type } of element.engine
          .attributes)
          variables.push({
            object: element.id,
            objectName: name,
            attribute,
            type: type.trim(),
            initially: initially.get(attribute)?.trim() ?? '',
          });
        break;
      }
      default:
        break;
    }
  }
  const operationalisations = model.links.flatMap(
    (link): Operationalisation[] => {
      if (link.kind !== OPERATIONALISATION) return [];
      const { required } = link.properties.engine;
      if (!required) return [];
      return [
        {
          id: link.id,
          operation: link.source,
          requirement: link.target,
          ReqPre: conditionOf(required.ReqPre),
          ReqTrig: conditionOf(required.ReqTrig),
          ReqPost: conditionOf(required.ReqPost),
        },
      ];
    },
  );
  return { requirements, agents, operations, operationalisations, variables };
};
