/**
 * A KAOS model as kaossim reads it (goal-controller#193): its quality
 * variables and objective functions (FSE'04 §3.1), where each variable is
 * defined (a goal's estimate, a refinement's equation, an agent's estimate
 * under an assignment), and its decision points (RE'11 §II, D2): a goal
 * refined several ways, or assigned to several agents, each way an option
 * by its `SysRef`. The keys are kaossim's dialect's (./definition.ts), keyed
 * by the names the model writes (`QualityVariable[ResponseTime]`): each is
 * read from its text here, by the value type the dialect gives it, so that
 * a value written with an error is one of the model's problems (and the
 * dialect's checks say so too).
 */
import {
  distributionOf,
  keyedKeyOf,
  probabilityOf,
  type Distribution,
} from '@goal-controller/dialect';
import {
  readAssertion,
  readExpression,
  type AssertionReading,
  type ExpressionTree,
} from '@goal-controller/goal-language';
import type { AnalysisElement, AnalysisLink, AnalysisModel } from '../analysis';
import {
  MODALS,
  QUALITY_SORTS,
  type Modal,
  type QualitySort,
} from './definition';

const GOAL_KINDS = new Set(['kaos.BehavioralGoal', 'kaos.Softgoal']);
const HUB = 'kaos.RefinementLinkHub';
const LEG = 'kaos.RefinementLinkStart';
const END = 'kaos.RefinementLinkEnd';
const ASSIGNMENT = 'kaos.ResponsibilityAssignment';

/** A quality variable (FSE'04 §3.1): its name, the goal it is of, its sort. */
export type QualityVariable = {
  name: string;
  goal: string;
  sort: QualitySort;
  sampleSpace?: string;
  definition?: string;
};

/** What an objective function measures: the probability of a condition, or the mean of an expression. */
export type ObjectiveDefinition =
  | { measure: 'probability'; event: AssertionReading; text: string }
  | { measure: 'mean'; of: ExpressionTree; text: string };

/** An objective function (FSE'04 §3.1): `{ def, modal, target, current }`. */
export type ObjectiveFunction = {
  name: string;
  goal: string;
  def: ObjectiveDefinition;
  modal: Modal;
  target?: number;
  current?: number;
};

/** How a variable is defined in one place: an estimate, an equation, or a Boolean one. */
export type VariableDefinition =
  | { kind: 'distribution'; distribution: Distribution; text: string }
  | { kind: 'equation'; expression: ExpressionTree; text: string }
  | { kind: 'boolean'; condition: AssertionReading; text: string };

/** The definitions one place gives, by variable. */
export type Definitions = ReadonlyMap<string, VariableDefinition>;

/** A goal's refinement: its hub, its option (`SysRef`, '' for none), its sub-goals, its equations. */
export type Refinement = {
  id: string;
  sysRef: string;
  children: readonly string[];
  /** the hub and its legs' link ids */
  links: readonly string[];
  definitions: Definitions;
};

/** A goal's responsibility assignment: the link, the agent, its option, the agent's estimates. */
export type Assignment = {
  id: string;
  agent: string;
  sysRef: string;
  definitions: Definitions;
};

/** A decision point (RE'11 §II): a goal refined, or assigned, several ways; its options by SysRef. */
export type DecisionPoint = {
  goal: string;
  via: 'refinement' | 'assignment';
  options: readonly { sysRef: string; at: string }[];
};

/** The model, quantitatively: goals, their refinements and assignments, variables, objectives, decisions. */
export type QuantitativeModel = {
  goals: ReadonlyMap<string, AnalysisElement>;
  /** the goals no refinement has as a sub-goal */
  roots: readonly string[];
  refinements: ReadonlyMap<string, readonly Refinement[]>;
  assignments: ReadonlyMap<string, readonly Assignment[]>;
  /** each goal's own estimates (`Distribution[v]` on it) */
  estimates: ReadonlyMap<string, Definitions>;
  variables: ReadonlyMap<string, QualityVariable>;
  objectives: readonly ObjectiveFunction[];
  decisions: readonly DecisionPoint[];
  /** what can't be read, in the model's order */
  problems: readonly string[];
};

/** An item's keyed texts for one key (`QualityVariable[v]`), by name, in the order written. */
const keyed = (
  properties: Readonly<Record<string, string>>,
  key: string,
): [name: string, text: string][] =>
  Object.entries(properties).flatMap(([written, text]) => {
    const read = keyedKeyOf(written);
    return read && read.key === key && text.trim()
      ? [[read.name, text.trim()]]
      : [];
  });

const isSort = (text: string): text is QualitySort =>
  (QUALITY_SORTS as readonly string[]).includes(text);
const isModal = (text: string): text is Modal =>
  (MODALS as readonly string[]).includes(text);

/** Reads a model's quantities, structure and decision points. */
export const quantitativeModel = (model: AnalysisModel): QuantitativeModel => {
  const problems: string[] = [];
  const nameOf = new Map(model.elements.map((e) => [e.id, e.name.trim()]));
  const label = (id: string) => nameOf.get(id) || id;

  /** an item's definitions: its `Distribution[v]`, and on a hub its equations */
  const definitionsOf = (
    item: { id: string; properties: Readonly<Record<string, string>> },
    where: string,
    equations: boolean,
  ): Map<string, VariableDefinition> => {
    const found = new Map<string, VariableDefinition>();
    const add = (name: string, definition: VariableDefinition) => {
      if (found.has(name))
        problems.push(`${where}: ${name} is defined twice here`);
      else found.set(name, definition);
    };
    for (const [name, text] of keyed(item.properties, 'Distribution')) {
      const distribution = distributionOf(text, { point: true, range: 'real' });
      if (distribution) add(name, { kind: 'distribution', distribution, text });
      else problems.push(`${where}: ${name}'s distribution ${text} is not one`);
    }
    if (!equations) return found;
    for (const [name, text] of keyed(item.properties, 'Equation')) {
      const expression = readExpression(text);
      if (expression)
        add(name, { kind: 'equation', expression: expression.tree, text });
      else problems.push(`${where}: ${name}'s equation ${text} is not one`);
    }
    for (const [name, text] of keyed(item.properties, 'BooleanEquation')) {
      const condition = readAssertion(text);
      if (condition) add(name, { kind: 'boolean', condition, text });
      else problems.push(`${where}: ${name}'s condition ${text} is not one`);
    }
    return found;
  };

  const goals = new Map<string, AnalysisElement>();
  const estimates = new Map<string, Definitions>();
  const variables = new Map<string, QualityVariable>();
  const objectives: ObjectiveFunction[] = [];
  for (const element of model.elements) {
    if (!GOAL_KINDS.has(element.kind)) continue;
    goals.set(element.id, element);
    const where = label(element.id);
    const { properties } = element;
    const own = (key: string) => new Map(keyed(properties, key));
    const sampleSpaces = own('SampleSpace');
    const meanings = own('QualityDefinition');
    for (const [name, text] of keyed(properties, 'QualityVariable')) {
      if (!isSort(text)) {
        problems.push(
          `${where}: ${name}'s sort is Time, Boolean or Number, not ${text}`,
        );
        continue;
      }
      const declared = variables.get(name);
      if (declared) {
        problems.push(
          `${where}: ${name} is already a quality variable of ${label(declared.goal)}`,
        );
        continue;
      }
      variables.set(name, {
        name,
        goal: element.id,
        sort: text,
        ...(sampleSpaces.has(name) && { sampleSpace: sampleSpaces.get(name) }),
        ...(meanings.has(name) && { definition: meanings.get(name) }),
      });
    }
    estimates.set(element.id, definitionsOf(element, where, false));
    const modals = own('Modal');
    const targets = own('Target');
    const currents = own('Current');
    const means = own('Mean');
    const events = own('Objective');
    for (const name of new Set([...events.keys(), ...means.keys()])) {
      const event = events.get(name);
      const mean = means.get(name);
      if (event !== undefined && mean !== undefined) {
        problems.push(
          `${where}: objective ${name} is both a probability and a mean`,
        );
        continue;
      }
      let def: ObjectiveDefinition | null = null;
      if (event !== undefined) {
        const condition = readAssertion(event);
        if (condition)
          def = { measure: 'probability', event: condition, text: event };
      } else if (mean !== undefined) {
        const expression = readExpression(mean);
        if (expression)
          def = { measure: 'mean', of: expression.tree, text: mean };
      }
      if (!def) {
        problems.push(
          `${where}: objective ${name}'s definition ${event ?? mean} is not one`,
        );
        continue;
      }
      const modal = modals.get(name) ?? '';
      if (!isModal(modal)) {
        problems.push(
          `${where}: objective ${name}'s modality is Max or Min, not ${modal || 'unset'}`,
        );
        continue;
      }
      const number = (text: string | undefined, what: string) => {
        if (text === undefined) return undefined;
        const n = probabilityOf(text);
        if (n === null)
          problems.push(
            `${where}: objective ${name}'s ${what} is a probability, not ${text}`,
          );
        return n ?? undefined;
      };
      const target = number(targets.get(name), 'target');
      const current = number(currents.get(name), 'current value');
      objectives.push({
        name,
        goal: element.id,
        def,
        modal,
        ...(target !== undefined && { target }),
        ...(current !== undefined && { current }),
      });
    }
  }

  // refinements: hubs, their legs (sub-goal → hub) and their end (hub → goal)
  const hubElements = new Map(
    model.elements.filter((e) => e.kind === HUB).map((e) => [e.id, e]),
  );
  const parents = new Map<string, string>();
  const legs = new Map<string, AnalysisLink[]>();
  const ends = new Map<string, AnalysisLink>();
  for (const link of model.links) {
    if (link.kind === END && hubElements.has(link.source)) {
      parents.set(link.source, link.target);
      ends.set(link.source, link);
    } else if (link.kind === LEG && hubElements.has(link.target))
      legs.set(link.target, [...(legs.get(link.target) ?? []), link]);
  }
  const refinements = new Map<string, Refinement[]>();
  const children = new Set<string>();
  for (const [id, hub] of hubElements) {
    const parent = parents.get(id);
    if (parent === undefined || !goals.has(parent)) continue;
    const hubLegs = legs.get(id) ?? [];
    for (const leg of hubLegs) children.add(leg.source);
    const refinement: Refinement = {
      id,
      sysRef: (hub.properties.SysRef ?? '').trim(),
      children: hubLegs.map((leg) => leg.source),
      links: [...hubLegs.map((leg) => leg.id), ends.get(id)!.id],
      definitions: definitionsOf(hub, `a refinement of ${label(parent)}`, true),
    };
    refinements.set(parent, [...(refinements.get(parent) ?? []), refinement]);
  }
  const assignments = new Map<string, Assignment[]>();
  for (const link of model.links) {
    if (link.kind !== ASSIGNMENT || !goals.has(link.target)) continue;
    const assignment: Assignment = {
      id: link.id,
      agent: link.source,
      sysRef: (link.properties.SysRef ?? '').trim(),
      definitions: definitionsOf(
        link,
        `${label(link.target)} assigned to ${label(link.source)}`,
        false,
      ),
    };
    assignments.set(link.target, [
      ...(assignments.get(link.target) ?? []),
      assignment,
    ]);
  }

  // decision points: several refinements, or several assignments, of a goal
  const decisions: DecisionPoint[] = [];
  const sysRefs = new Map<string, string>();
  const decision = (
    goal: string,
    via: DecisionPoint['via'],
    ways: readonly { id: string; sysRef: string }[],
  ) => {
    if (ways.length < 2) return;
    const options: { sysRef: string; at: string }[] = [];
    for (const way of ways) {
      const where = `${label(goal)}'s ${via}s`;
      if (!way.sysRef) {
        problems.push(`${where}: an alternative without a SysRef is no option`);
        continue;
      }
      const taken = sysRefs.get(way.sysRef);
      if (taken !== undefined) {
        problems.push(
          `${where}: SysRef ${way.sysRef} is already an option of ${label(taken)}`,
        );
        continue;
      }
      sysRefs.set(way.sysRef, goal);
      options.push({ sysRef: way.sysRef, at: way.id });
    }
    if (options.length) decisions.push({ goal, via, options });
  };
  for (const goal of goals.keys()) {
    decision(goal, 'refinement', refinements.get(goal) ?? []);
    decision(goal, 'assignment', assignments.get(goal) ?? []);
  }

  return {
    goals,
    roots: [...goals.keys()].filter((id) => !children.has(id)),
    refinements,
    assignments,
    estimates,
    variables,
    objectives,
    decisions,
    problems,
  };
};
