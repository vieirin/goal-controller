/**
 * kaoslts's model and its FSP (goal-controller#209): a KAOS operation model
 * as LTSA's input, by KAOS2LTSA's five steps (Letier, Kramer, Magee and
 * Uchitel, ASE'08 §4; transcribed in docs/papers/letier-fse02-icse02.md,
 * §3.4):
 *
 * 1. **Bounding and fluents.** Each Boolean attribute of an object (an
 *    agent's too) is a fluent, named after the attribute (`highWater` is
 *    `HighWater`; after its object as well, `SumpHighWater`, when two objects
 *    have one of that name), initially its `Initially` value (false unset).
 *    Bounding an integer or an enumeration is the analyst's step: such an
 *    attribute is said and left out.
 * 2. **Fluent definitions.** Each operation is an event of its name (an FSP
 *    action: `startPump`); an operation initiates (terminates) the fluents
 *    its DomPost has a positive (negative) occurrence of. A DomPost that is
 *    no conjunction of fluents defines none, and is said.
 * 3. **Domain preconditions**, `DomPre_<op>`, ASE'08's template; and, for
 *    the KAOS trace semantics (each event at most once between two ticks),
 *    one process per object: the events changing its attributes occur at
 *    most once between two ticks (`OnePerTick_<Object>`; the paper's prose
 *    says per fluent, its models archive groups the water level's two
 *    fluents in one process, as an object here does).
 * 4. **Required conditions**, `ReqPre_<op>_For_<Goal>`, `ReqTrig_…`,
 *    `ReqPost_…`, ASE'08's templates.
 * 5. **Composition.** Each agent's processes, those of the operations it
 *    performs and of the objects only they change, are composed as the
 *    agent; the agents (and what no agent performs) as the system. Each
 *    requirement with a formal definition is an `assert`, its synchronous
 *    reading encoded asynchronously (ASE'08 §2.2.3's `Tr`), for LTSA's
 *    checks (§5.1).
 *
 * A condition that is not a state formula over the fluents (a temporal
 * operator, an attribute that is no fluent, a comparison) is not
 * translated: its constraint is left out and said, in the file as a
 * comment.
 */
import type { LtlNode } from '@goal-controller/goal-language';
import type {
  Condition,
  Operation,
  OperationAgent,
  OperationModel,
  RequiredKind,
  StateVariable,
} from './operations';
import { REQUIRED_KINDS } from './operations';

/** A name as an FSP process or fluent name: its words, each capitalised (`Maintain [PumpOn]` is `MaintainPumpOn`). */
export const processName = (text: string): string => {
  const name = text
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join('');
  return /^[A-Z]/.test(name) ? name : `P${name}`;
};

/** A name as an FSP action: as written when it is one (`startPump`), else its words in lower camel case. */
export const actionName = (text: string): string => {
  if (/^[a-z][A-Za-z0-9_]*$/.test(text)) return text;
  const name = processName(text);
  return name[0]!.toLowerCase() + name.slice(1);
};

/** A requirement's name without its KAOS pattern (`Maintain [PumpOn]` is `PumpOn`). */
const requirementName = (text: string): string =>
  processName(
    text.replace(
      /^\s*(Achieve|Maintain|Avoid|Cease|Optimize)\s*\[(.*)\]\s*$/i,
      '$2',
    ),
  );

const BOOLEAN_TYPES = new Set(['bool', 'boolean']);
const isBooleanType = (type: string) => BOOLEAN_TYPES.has(type.toLowerCase());

export type Fluent = {
  name: string;
  variable: StateVariable;
  /** actions, in the model's order of their operations */
  initiating: string[];
  terminating: string[];
  initially: boolean;
};

/** One FSP definition: a constraint, a process, a composition. */
export type FspDefinition = {
  /** its process name */
  name: string;
  /** its FSP text, one or more lines */
  lines: string[];
  /** the model elements it comes from (an operation, a requirement, an object) */
  owners: string[];
};

/** A constraint of steps 3-4: the condition it translates, as FLTL. */
export type FspConstraint = FspDefinition & {
  kind: 'DomPre' | RequiredKind;
  /** its operation's action */
  action: string;
  /** its requirement's FSP name (a required condition's) */
  requirement?: string;
  /** the condition, as FLTL over the fluents */
  condition: string;
};

/** A step 3 process: an object's events, at most one between two ticks. */
export type FspTickProcess = FspDefinition & {
  object: string;
  events: string[];
};

/** An agent's part of the system (step 5). */
export type FspAgent = {
  id: string;
  name: string;
  constraints: FspConstraint[];
  processes: FspTickProcess[];
};

export type LtsModel = {
  fluents: Fluent[];
  /** `tick`, then each operation's action */
  alphabet: string[];
  agents: FspAgent[];
  /** what no agent (or several) performs: composed in the system only */
  shared: { constraints: FspConstraint[]; processes: FspTickProcess[] };
  asserts: FspDefinition[];
  /** what is not translated, and why */
  notes: string[];
};

/** A formula as FLTL over the fluents, or why it can't be. */
type Fltl = { text: string; atomic: boolean } | { reason: string };

const fltlFailure = (fltl: Fltl): fltl is { reason: string } =>
  'reason' in fltl;

const wrap = (f: { text: string; atomic: boolean }) =>
  f.atomic ? f.text : `(${f.text})`;

/** The FSP model of an operation model (`operationModelOf`). */
export const ltsModel = (model: OperationModel): LtsModel => {
  const notes: string[] = [];
  // step 1: the Boolean attributes are the fluents
  const named = new Map<string, number>();
  for (const v of model.variables)
    if (isBooleanType(v.type))
      named.set(v.attribute, (named.get(v.attribute) ?? 0) + 1);
  const fluentOf = new Map<string, Fluent>();
  for (const variable of model.variables) {
    const key = `${variable.object}.${variable.attribute}`;
    if (!isBooleanType(variable.type)) {
      notes.push(
        `${key} : ${variable.type} is no Boolean attribute: bounding it as a parameterised fluent is the analyst's step 1, left out`,
      );
      continue;
    }
    fluentOf.set(key, {
      name:
        named.get(variable.attribute)! > 1
          ? processName(`${variable.objectName} ${variable.attribute}`)
          : processName(variable.attribute),
      variable,
      initiating: [],
      terminating: [],
      initially: variable.initially.toLowerCase() === 'true',
    });
  }
  // step 2: the events, and the fluents their DomPosts define
  const used = new Set<string>(['tick']);
  const actionOf = new Map<string, string>();
  for (const op of model.operations) {
    let action = actionName(op.name);
    for (let n = 2; used.has(action); n++)
      action = `${actionName(op.name)}_${n}`;
    used.add(action);
    actionOf.set(op.id, action);
  }
  /** a DomPost's fluent occurrences: [fluent, positive], or why it is no conjunction of them */
  const occurrences = (
    node: LtlNode,
    positive = true,
  ): [Fluent, boolean][] | string => {
    switch (node.kind) {
      case 'paren':
        return occurrences(node.expr, positive);
      case 'and': {
        if (!positive) return 'a negated conjunction';
        const left = occurrences(node.left);
        if (typeof left === 'string') return left;
        const right = occurrences(node.right);
        return typeof right === 'string' ? right : [...left, ...right];
      }
      case 'not':
        return occurrences(node.expr, !positive);
      default: {
        const literal = fluentLiteral(node);
        if (typeof literal === 'string') return literal;
        return [[literal.fluent, literal.positive === positive]];
      }
    }
  };
  /** an atom as a fluent and its polarity, or why it is none */
  const fluentLiteral = (
    node: LtlNode,
  ): { fluent: Fluent; positive: boolean } | string => {
    const access =
      node.kind === 'comparison' &&
      node.left.kind === 'attributeAccess' &&
      node.right.kind === 'literal' &&
      typeof node.right.value === 'boolean' &&
      (node.operator === '==' || node.operator === '!=')
        ? {
            at: node.left,
            positive: node.right.value === (node.operator === '=='),
          }
        : node.kind === 'attributeAccess'
          ? { at: node, positive: true }
          : null;
    if (!access) return `it has a ${node.kind}, not a fluent`;
    const key = `${access.at.variable}.${access.at.attribute}`;
    const fluent = fluentOf.get(key);
    return fluent
      ? { fluent, positive: access.positive }
      : `${key} is no Boolean attribute of an object`;
  };
  for (const op of model.operations) {
    if (!op.domPost) continue;
    const action = actionOf.get(op.id)!;
    const found = op.domPost.formula
      ? occurrences(op.domPost.formula)
      : `it doesn't parse: ${op.domPost.error}`;
    if (typeof found === 'string') {
      notes.push(
        `${op.name}'s DomPost defines no fluent (step 2 needs a conjunction of fluents): ${found}`,
      );
      continue;
    }
    const both = found.filter(
      ([fluent, positive]) =>
        positive && found.some(([f, p]) => f === fluent && !p),
    );
    if (both.length) {
      notes.push(
        `${op.name}'s DomPost has ${both[0]![0].name} both positively and negatively: read as false (ASE'08 §4, step 2), it defines no fluent`,
      );
      continue;
    }
    for (const [fluent, positive] of found) {
      const events = positive ? fluent.initiating : fluent.terminating;
      if (!events.includes(action)) events.push(action);
    }
  }
  const fluents = [...fluentOf.values()].filter((fluent) => {
    if (fluent.initiating.length || fluent.terminating.length) return true;
    notes.push(
      `${fluent.variable.object}.${fluent.variable.attribute}: no operation's DomPost changes it, so it is no fluent`,
    );
    return false;
  });
  const live = new Set(fluents);

  /** a state formula as FLTL over the fluents */
  const fltl = (node: LtlNode): Fltl => {
    const binary = (left: LtlNode, right: LtlNode, op: string): Fltl => {
      const l = fltl(left);
      if (fltlFailure(l)) return l;
      const r = fltl(right);
      if (fltlFailure(r)) return r;
      return { text: `${wrap(l)} ${op} ${wrap(r)}`, atomic: false };
    };
    switch (node.kind) {
      case 'paren':
        return fltl(node.expr);
      case 'not': {
        const inner = fltl(node.expr);
        return fltlFailure(inner) ? inner : negation(inner);
      }
      case 'and':
        return binary(node.left, node.right, '&&');
      case 'or':
        return binary(node.left, node.right, '||');
      case 'implies':
        return binary(node.left, node.right, '->');
      case 'iff':
        return binary(node.left, node.right, '<->');
      default: {
        const literal = fluentLiteral(node);
        if (typeof literal === 'string') return { reason: literal };
        if (!live.has(literal.fluent))
          return {
            reason: `${literal.fluent.name} is no fluent: no operation changes it`,
          };
        const atom = { text: literal.fluent.name, atomic: true };
        return literal.positive ? atom : negation(atom);
      }
    }
  };
  /** `!` binds tightest: a negation needs no parentheses, and `! !P` keeps its two tokens apart */
  const negation = (f: { text: string; atomic: boolean }) => {
    const operand = wrap(f);
    return {
      text: `!${operand.startsWith('!') ? ' ' : ''}${operand}`,
      atomic: true,
    };
  };
  const conditionFltl = (condition: Condition): Fltl =>
    condition.formula
      ? fltl(condition.formula)
      : { reason: `it doesn't parse: ${condition.error}` };

  const requirements = new Map(model.requirements.map((r) => [r.id, r]));
  const constraintsOf = (op: Operation): FspConstraint[] => {
    const action = actionOf.get(op.id)!;
    const constraints: FspConstraint[] = [];
    const domPre = op.domPre ? conditionFltl(op.domPre) : null;
    if (domPre && fltlFailure(domPre))
      notes.push(`DomPre_${action}: not translated, ${domPre.reason}`);
    else if (domPre)
      constraints.push({
        kind: 'DomPre',
        name: `DomPre_${action}`,
        action,
        condition: domPre.text,
        owners: [op.id],
        lines: [
          `constraint DomPre_${action} = [](tick && ${negation(domPre).text} -> X(!${action} W tick))`,
        ],
      });
    for (const link of model.operationalisations) {
      if (link.operation !== op.id) continue;
      const requirement = requirements.get(link.requirement);
      const goal = requirementName(requirement?.name ?? link.requirement);
      for (const kind of REQUIRED_KINDS) {
        const condition = link[kind];
        if (!condition) continue;
        const name = `${kind}_${action}_For_${goal}`;
        const read = conditionFltl(condition);
        if (fltlFailure(read)) {
          notes.push(`${name}: not translated, ${read.reason}`);
          continue;
        }
        if (kind === 'ReqTrig' && domPre && fltlFailure(domPre)) {
          notes.push(`${name}: not translated, its operation's DomPre isn't`);
          continue;
        }
        const body =
          kind === 'ReqPre'
            ? `[](tick && ${negation(read).text} -> X(!${action} W tick))`
            : kind === 'ReqTrig'
              ? `[](tick && ${wrap(read)}${domPre && !fltlFailure(domPre) ? ` && ${wrap(domPre)}` : ''} -> X(!tick W ${action}))`
              : `[](${action} -> (!tick W (tick && ${wrap(read)})))`;
        constraints.push({
          kind,
          name,
          action,
          requirement: goal,
          condition: read.text,
          owners: [op.id, link.requirement],
          lines: [`constraint ${name} = ${body}`],
        });
      }
    }
    return constraints;
  };

  // step 3's tick processes: an object's events
  const objects = new Map<string, { name: string; events: Set<string> }>();
  for (const fluent of fluents) {
    const { object, objectName } = fluent.variable;
    const entry = objects.get(object) ?? {
      name: objectName,
      events: new Set(),
    };
    for (const action of [...fluent.initiating, ...fluent.terminating])
      entry.events.add(action);
    objects.set(object, entry);
  }
  const processes: FspTickProcess[] = [...objects].map(
    ([object, { name, events }]) => {
      const process = `OnePerTick_${processName(name)}`;
      const ordered = [...actionOf.values()].filter((a) => events.has(a));
      return {
        name: process,
        object,
        events: ordered,
        owners: [object],
        lines: [
          `${process} = (tick -> Ticked),`,
          `  Ticked = (tick -> Ticked | {${ordered.join(', ')}} -> tick -> Ticked).`,
        ],
      };
    },
  );

  // step 5: each agent with what it performs alone
  const performerOf = (action: string): OperationAgent | null => {
    const op = model.operations.find((o) => actionOf.get(o.id) === action);
    const ids = op?.performers ?? [];
    return ids.length === 1
      ? (model.agents.find((agent) => agent.id === ids[0]) ?? null)
      : null;
  };
  const agentNames = new Set<string>();
  const agents: FspAgent[] = model.agents.map((agent) => {
    let name = processName(agent.name);
    while (agentNames.has(name) || used.has(name)) name = `${name}Agent`;
    agentNames.add(name);
    return { id: agent.id, name, constraints: [], processes: [] };
  });
  const shared: LtsModel['shared'] = { constraints: [], processes: [] };
  const holder = (agent: OperationAgent | null) =>
    (agent && agents.find((a) => a.id === agent.id)) ?? shared;
  for (const op of model.operations) {
    if (op.performers.length !== 1)
      notes.push(
        `${op.name}: ${op.performers.length ? 'several agents perform it' : 'no agent performs it'}, its constraints are the system's`,
      );
    holder(performerOf(actionOf.get(op.id)!)).constraints.push(
      ...constraintsOf(op),
    );
  }
  for (const process of processes) {
    const performers = new Set(process.events.map(performerOf));
    holder(performers.size === 1 ? [...performers][0]! : null).processes.push(
      process,
    );
  }

  // the requirements, for LTSA's checks: Tr of each formal definition
  const asserts = model.requirements.flatMap((requirement): FspDefinition[] => {
    const spec = requirement.formalSpec;
    if (!spec) return [];
    const name = requirementName(requirement.name);
    const encoded = spec.formula
      ? tr(strong(spec.formula))
      : { reason: `it doesn't parse: ${spec.error}` };
    if (fltlFailure(encoded)) {
      notes.push(`assert ${name}: not translated, ${encoded.reason}`);
      return [];
    }
    return [
      {
        name,
        owners: [requirement.id],
        lines: [`assert ${name} = ${encoded.text}`],
      },
    ];
  });
  /** a top-level implication read as KAOS's strong one, `□(C → T)` */
  function strong(node: LtlNode): LtlNode {
    if (node.kind === 'forall' || node.kind === 'paren')
      return strong(node.kind === 'forall' ? node.body : node.expr);
    return node.kind === 'strongImplies' || node.kind === 'implies'
      ? {
          kind: 'always',
          surface: 'symbolic',
          expr: {
            kind: 'implies',
            left: node.left,
            right: node.right,
            surface: 'symbolic',
          },
        }
      : node;
  }
  /** ASE'08's Tr (§2.2.3): a synchronous formula, asynchronously */
  function tr(node: LtlNode): Fltl {
    /** a temporal operator's application, `X(…)`: self-delimited */
    const unary = (expr: LtlNode, make: (p: string) => string): Fltl => {
      const p = tr(expr);
      return fltlFailure(p) ? p : { text: make(wrap(p)), atomic: true };
    };
    const pair = (
      left: LtlNode,
      right: LtlNode,
      make: (p: string, q: string) => string,
    ): Fltl => {
      const p = tr(left);
      if (fltlFailure(p)) return p;
      const q = tr(right);
      return fltlFailure(q)
        ? q
        : { text: make(wrap(p), wrap(q)), atomic: false };
    };
    switch (node.kind) {
      case 'paren':
        return tr(node.expr);
      case 'always':
        return node.bound
          ? { reason: 'a bounded always' }
          : unary(node.expr, (p) => `[](tick -> ${p})`);
      case 'eventually':
        return node.bound
          ? { reason: 'a bounded eventually' }
          : unary(node.expr, (p) => `<>(tick && ${p})`);
      case 'next':
        return unary(node.expr, (p) => `X(!tick W (tick && ${p}))`);
      case 'until':
        return node.bound
          ? { reason: 'a bounded until' }
          : pair(
              node.left,
              node.right,
              (p, q) => `(tick -> ${p}) U (tick && ${q})`,
            );
      case 'weakUntil':
        // P W Q is P U Q or □P
        return node.bound
          ? { reason: 'a bounded unless' }
          : pair(
              node.left,
              node.right,
              (p, q) => `((tick -> ${p}) U (tick && ${q})) || [](tick -> ${p})`,
            );
      case 'not': {
        const p = tr(node.expr);
        return fltlFailure(p) ? p : negation(p);
      }
      case 'and':
        return pair(node.left, node.right, (p, q) => `${p} && ${q}`);
      case 'or':
        return pair(node.left, node.right, (p, q) => `${p} || ${q}`);
      case 'implies':
        return pair(node.left, node.right, (p, q) => `${p} -> ${q}`);
      case 'iff':
        return pair(node.left, node.right, (p, q) => `${p} <-> ${q}`);
      case 'strongImplies':
        return { reason: 'a strong implication under another operator' };
      case 'comparison':
      case 'attributeAccess':
        return fltl(node);
      default:
        return { reason: `it has a ${node.kind} operator` };
    }
  }

  return {
    fluents,
    alphabet: ['tick', ...actionOf.values()],
    agents,
    shared,
    asserts,
    notes,
  };
};
