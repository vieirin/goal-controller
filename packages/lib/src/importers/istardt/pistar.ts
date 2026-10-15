/**
 * An iStarDT-X document (./read) as a piStar model in the iStar-DT dialect
 * (goal-controller#117 D1–D7):
 *
 * - every element numbered by kind in the file's order (`G1`, `T1`, `Q1`,
 *   `E1`, `C1`, `P1`, `V1`), its name the file's description (its
 *   identifier when it has none), and an `identifier` property where the
 *   file's name isn't the camelCase of that name;
 * - refinements child to parent (a goal's child goals, then its tasks, as
 *   the translator reads them), a task's effects by effect links, `pre` and
 *   `npr` by precedence links (a formula that isn't one element's name
 *   becomes a condition the importer names);
 * - formulas as the goal language's texts: a quality's an expression, a
 *   condition's an assertion, fully parenthesised;
 * - the cross-run, exported and initialized sets as the actor's ordered
 *   lists, a continuous export's bounds on its element;
 * - no positions: the file has none, and the layout (importers/layout.ts)
 *   places everything.
 */
import { istardtMetamodelBlock } from '../../engines/istardt/extension';
import { SET_KEYS } from '../../engines/istardt/model';
import {
  camelCase,
  ID_PREFIX,
  ISTARDT_KINDS,
  ISTARDT_LINKS,
  PISTAR_OF_KIND,
  type IstardtKind,
} from '../../engines/istardt/vocabulary';
import { layOut } from '../layout';
import type { ImportDiagnostic } from '../types';
import type { Formula, IstardtDocument } from './read';

type Json = Record<string, unknown>;

/** The kind each of the file's id tags names. */
const KIND_OF_TAG: Readonly<Record<string, IstardtKind>> = {
  goalID: 'goal',
  taskID: 'task',
  qualID: 'quality',
  effectID: 'effect',
  conditionID: 'condition',
  predicateID: 'predicate',
  variableID: 'variable',
};

const PRECEDENCE = { add: 1, subtract: 1, multiply: 2, divide: 2 } as const;
const SYMBOL = { add: '+', subtract: '-', multiply: '*', divide: '/' } as const;
const COMPARATOR = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
  neq: '!=',
} as const;

/** How tightly a numeric formula binds, as the goal language reads it. */
const precedenceOf = (formula: Formula): number =>
  formula.op in PRECEDENCE
    ? PRECEDENCE[formula.op as keyof typeof PRECEDENCE]
    : formula.op === 'negate' ||
        (formula.op === 'number' && formula.value.startsWith('-'))
      ? 3
      : 4;

/**
 * A numeric formula as an `expression` value: left to right, parenthesised
 * only where the tree's shape needs it (a right operand as tight as its
 * operator, a looser operand), so it reads back as the same tree.
 */
export const expressionText = (formula: Formula): string => {
  const operand = (f: Formula, at: number, right: boolean) => {
    const text = expressionText(f);
    const p = precedenceOf(f);
    return p < at || (right && p === at) ? `(${text})` : text;
  };
  switch (formula.op) {
    case 'number':
      return formula.value.trim();
    case 'atom':
      return formula.name;
    case 'previous':
      return `previous(${formula.name})`;
    case 'add':
    case 'multiply': {
      const at = PRECEDENCE[formula.op];
      return formula.args
        .map((arg, i) => operand(arg, at, i > 0))
        .join(` ${SYMBOL[formula.op]} `);
    }
    case 'subtract':
    case 'divide': {
      const at = PRECEDENCE[formula.op];
      return `${operand(formula.left, at, false)} ${SYMBOL[formula.op]} ${operand(formula.right, at, true)}`;
    }
    case 'negate':
      return `-${operand(formula.arg, 3, false)}`;
    default:
      throw new Error(`<${formula.op}> is not numeric`);
  }
};

/**
 * A boolean formula as an `assertion` value, fully parenthesised: `!` takes
 * everything after it, so a negation is `(!(x))`, and every `&` and `|`
 * its own parentheses (#117, blue's #126 note).
 */
export const assertionText = (formula: Formula): string => {
  switch (formula.op) {
    case 'bool':
      return formula.value.trim() === 'true' ? 'true' : 'false';
    case 'atom':
      return formula.name;
    case 'previous':
      return `previous(${formula.name})`;
    case 'and':
    case 'or':
      return formula.args
        .map(assertionText)
        .reduce(
          (left, right) =>
            `(${left} ${formula.op === 'and' ? '&' : '|'} ${right})`,
        );
    case 'not':
      return `(!(${assertionText(formula.arg)}))`;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
    case 'eq':
    case 'neq':
      return `(${expressionText(formula.left)} ${COMPARATOR[formula.op]} ${expressionText(formula.right)})`;
    default:
      throw new Error(`<${formula.op}> is not boolean`);
  }
};

/** The names a formula's atoms give (to check they name declared elements). */
const atomsOf = (formula: Formula): { tag: string; name: string }[] => {
  switch (formula.op) {
    case 'atom':
    case 'previous':
      return [{ tag: formula.tag, name: formula.name }];
    case 'add':
    case 'multiply':
    case 'and':
    case 'or':
      return formula.args.flatMap(atomsOf);
    case 'not':
    case 'negate':
      return atomsOf(formula.arg);
    case 'number':
    case 'bool':
      return [];
    default:
      return [...atomsOf(formula.left), ...atomsOf(formula.right)];
  }
};

/** The effects that turn a predicate true. */
const effectsTurning = (document: IstardtDocument, predicate: string) =>
  document.tasks
    .flatMap((task) => task.effects)
    .filter((effect) => effect.turnsTrue.includes(predicate));

/**
 * A quality's formula as a weighted sum (#117 D3, mx2dtx's contribution
 * links), or null when it isn't one: every term `weight × q` for a declared
 * quality, or `weight × p` for a predicate exactly one effect turns true (and
 * nothing else), each source once. Its links write it back as it is.
 */
export const weightedSum = (
  formula: Formula,
  document: IstardtDocument,
): { tag: string; name: string; weight: string }[] | null => {
  const terms = formula.op === 'add' ? formula.args : [formula];
  const sources = new Set<string>();
  const out: { tag: string; name: string; weight: string }[] = [];
  for (const term of terms) {
    if (term.op !== 'multiply' || term.args.length !== 2) return null;
    const weight = term.args[0]!;
    const atom = term.args[1]!;
    if (weight.op !== 'number' || atom.op !== 'atom') return null;
    if (atom.tag === 'qualID') {
      if (!document.qualities.some((q) => q.name === atom.name)) return null;
    } else if (atom.tag === 'predicateID') {
      const effects = effectsTurning(document, atom.name);
      if (effects.length !== 1 || effects[0]!.turnsTrue.length !== 1)
        return null;
    } else return null;
    const source =
      atom.tag === 'qualID'
        ? atom.name
        : effectsTurning(document, atom.name)[0]!.name;
    if (sources.has(source)) return null;
    sources.add(source);
    out.push({ tag: atom.tag, name: atom.name, weight: weight.value.trim() });
  }
  return out;
};

export const toPistar = (
  document: IstardtDocument,
  diagnostics: ImportDiagnostic[],
  modelName = 'iStar-DT model',
): Json => {
  const warn = (message: string) =>
    diagnostics.push({ severity: 'warning', message });
  const info = (message: string) =>
    diagnostics.push({ severity: 'info', message });

  type Node = {
    kind: IstardtKind;
    file: string;
    /** the id its text starts with (`G1`) */
    id: string;
    /** its piStar id: the file's name, the source's id (importers.md) */
    pistarId: string;
    text: string;
    properties: Record<string, string>;
  };
  const nodes: Node[] = [];
  const byName = new Map<string, Node>();
  const counters = new Map<IstardtKind, number>();
  const add = (
    kind: IstardtKind,
    file: string,
    description: string,
    properties: Record<string, string> = {},
  ): Node => {
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    const id = `${ID_PREFIX[kind]}${n}`;
    const name = description.trim() || file;
    // a name two elements share keeps the second apart (a warning below)
    let pistarId = file || id;
    for (let k = 2; nodes.some((other) => other.pistarId === pistarId); k++)
      pistarId = `${file}#${k}`;
    const node: Node = {
      kind,
      file,
      id,
      pistarId,
      text: `${id}: ${name}`,
      properties: {
        ...(camelCase(name) !== file && { identifier: file }),
        ...properties,
      },
    };
    nodes.push(node);
    if (byName.has(file)) warn(`${file} names two elements: the first is read`);
    else byName.set(file, node);
    return node;
  };

  for (const goal of document.goals)
    add('goal', goal.name, goal.description, {
      ...(goal.root && {
        root: 'true',
        episodeLength: goal.episodeLength,
      }),
      ...(goal.terminal && { terminal: 'true' }),
    });
  for (const task of document.tasks) add('task', task.name, task.description);
  // each task's effect group: the hub its effects hang from, each with its
  // probability on its link (iStarDT-V's effectGroupLink)
  const groups: {
    pistarId: string;
    task: Node;
    effects: { node: Node; probability: string }[];
  }[] = [];
  document.tasks.forEach((task, i) => {
    const node = nodes.filter((n) => n.kind === 'task')[i]!;
    if (!task.effects.length) return;
    groups.push({
      pistarId: `${node.pistarId}/effectGroup`,
      task: node,
      effects: task.effects.map((effect) => ({
        node: add('effect', effect.name, effect.description, {
          satisfying: String(effect.satisfying),
          ...(effect.set.length && {
            set: effect.set.map((s) => `${s.variable}:${s.value}`).join(', '),
          }),
        }),
        probability: effect.probability,
      })),
    });
  });
  for (const quality of document.qualities) {
    if (!quality.formula) warn(`quality ${quality.name} has no formula`);
    const terms = quality.formula && weightedSum(quality.formula, document);
    add('quality', quality.name, quality.description, {
      ...(quality.formula &&
        !terms && { formula: expressionText(quality.formula) }),
      ...(quality.root && { root: 'true' }),
    });
  }
  for (const condition of document.conditions) {
    if (!condition.formula) warn(`condition ${condition.name} has no formula`);
    add('condition', condition.name, condition.description, {
      ...(condition.formula && {
        formula: assertionText(condition.formula),
      }),
    });
  }
  for (const predicate of document.predicates)
    add('predicate', predicate.name, predicate.description);
  for (const variable of document.variables)
    add('variable', variable.name, variable.description);

  // what the formulas and the sets name, said where it isn't declared
  const known = (name: string, what: string) => {
    if (byName.has(name)) return true;
    warn(`${what} names ${name}, which the file doesn't declare`);
    return false;
  };
  for (const effect of document.tasks.flatMap((t) => t.effects))
    for (const name of [
      ...effect.turnsTrue,
      ...effect.turnsFalse,
      ...effect.set.map((s) => s.variable),
    ])
      known(name, `effect ${effect.name}`);
  for (const { name, formula } of [
    ...document.qualities,
    ...document.conditions,
  ])
    for (const atom of formula ? atomsOf(formula) : [])
      if (
        known(atom.name, name) &&
        byName.get(atom.name)!.kind !== KIND_OF_TAG[atom.tag]
      )
        warn(
          `${name} names ${atom.name} as a ${KIND_OF_TAG[atom.tag]}, but it is a ${byName.get(atom.name)!.kind}`,
        );

  // links: refinements child to parent, effects, precedences
  const links: Json[] = [];
  const link = (
    type: string,
    source: { pistarId: string },
    target: { pistarId: string },
    extra: Json = {},
  ) =>
    links.push({
      id: `${source.pistarId}-${type.slice(type.indexOf('.') + 1)}-${target.pistarId}`,
      type,
      source: source.pistarId,
      target: target.pistarId,
      ...extra,
    });
  document.goals.forEach((goal) => {
    const parent = byName.get(goal.name)!;
    if (goal.children.length && !goal.relation)
      warn(
        `goal ${goal.name}'s refinement is neither AND nor OR: its children are read as OR`,
      );
    for (const { kind, ref } of goal.children) {
      const child = byName.get(ref);
      if (!child || child.kind !== kind) {
        warn(
          `goal ${goal.name} refines into ${ref}, which the file doesn't declare as a ${kind}`,
        );
        continue;
      }
      link(
        goal.relation === 'AND'
          ? 'istar.AndRefinementLink'
          : 'istar.OrRefinementLink',
        child,
        parent,
      );
    }
  });
  for (const group of groups) {
    link(ISTARDT_LINKS.effect, group.task, group);
    for (const { node, probability } of group.effects)
      link(ISTARDT_LINKS.effectGroup, group, node, {
        customProperties: { probability },
      });
  }
  // what each effect turns true and false: links to the predicates, in order
  for (const effect of document.tasks.flatMap((t) => t.effects))
    for (const [type, names] of [
      [ISTARDT_LINKS.turnsTrue, effect.turnsTrue],
      [ISTARDT_LINKS.turnsFalse, effect.turnsFalse],
    ] as const)
      for (const name of names)
        if (byName.get(name)?.kind === 'predicate')
          link(type, byName.get(effect.name)!, byName.get(name)!);
  // a quality that is a weighted sum: a utility link per term (#117 D3), from
  // the quality, or from the effect that turns the predicate true
  for (const quality of document.qualities)
    for (const { tag, name, weight } of (quality.formula &&
      weightedSum(quality.formula, document)) ||
      [])
      link(
        ISTARDT_LINKS.utility,
        tag === 'qualID'
          ? byName.get(name)!
          : byName.get(effectsTurning(document, name)[0]!.name)!,
        byName.get(quality.name)!,
        { customProperties: { weight } },
      );

  const precedence = (
    holder: Node,
    formula: Formula | null,
    which: 'pre' | 'npr',
  ) => {
    if (!formula) return;
    const type =
      which === 'pre'
        ? ISTARDT_LINKS.precedence
        : ISTARDT_LINKS.negativePrecedence;
    const named =
      formula.op === 'atom' &&
      ['goalID', 'taskID', 'conditionID'].includes(formula.tag) &&
      byName.get(formula.name);
    if (named) {
      link(type, named, holder);
      return;
    }
    // a formula of its own: a condition the importer names (#117 D2)
    const name = `${holder.file}${which === 'pre' ? 'Pre' : 'Npr'}`;
    const condition = add('condition', name, '', {
      formula: assertionText(formula),
    });
    info(
      `${holder.file}'s ${which} is a formula: read as condition ${condition.id} (${name})`,
    );
    link(type, condition, holder);
  };
  for (const goal of document.goals) {
    const node = byName.get(goal.name)!;
    precedence(node, goal.pre, 'pre');
    precedence(node, goal.npr, 'npr');
  }
  document.tasks.forEach((task) => {
    const node = byName.get(task.name)!;
    precedence(node, task.pre, 'pre');
    precedence(node, task.npr, 'npr');
    task.effects.forEach((effect) => {
      const effectNode = byName.get(effect.name)!;
      precedence(effectNode, effect.pre, 'pre');
      precedence(effectNode, effect.npr, 'npr');
    });
  });

  // the sets: the actor's ordered lists; a continuous export's bounds on its element
  const listed = (names: string[], what: string) =>
    names.filter((name) => known(name, what));
  for (const exported of document.exported)
    if (exported.continuous && byName.has(exported.ref))
      Object.assign(byName.get(exported.ref)!.properties, {
        exportMin: exported.minVal,
        exportMax: exported.maxVal,
      });
  const actorProperties: Record<string, string> = {};
  const crossRun = listed(document.crossRun, 'the cross-run set');
  const exported = listed(
    document.exported.map((e) => e.ref),
    'the exported set',
  );
  const initializations = document.initializations.filter((i) =>
    known(i.ref, 'the initializations'),
  );
  if (crossRun.length) actorProperties[SET_KEYS.crossRun] = crossRun.join(', ');
  if (exported.length) actorProperties[SET_KEYS.exported] = exported.join(', ');
  if (initializations.length)
    actorProperties[SET_KEYS.initializations] = initializations
      .map((i) => `${i.ref}:${i.value}`)
      .join(', ');

  const actor = {
    id: 'actor',
    text: document.actor.name || 'default',
    type: 'istar.Actor',
    customProperties: {
      ...(document.actor.description && {
        Description: document.actor.description,
      }),
      ...actorProperties,
    },
    nodes: [
      ...nodes.map((node) => ({
        id: node.pistarId,
        text: node.text,
        type: PISTAR_OF_KIND[node.kind],
        customProperties: node.properties,
      })),
      ...groups.map(({ pistarId }) => ({
        id: pistarId,
        text: '',
        type: ISTARDT_KINDS.effectGroup,
        customProperties: {},
      })),
    ],
  };
  const model: Json = {
    actors: [actor],
    orphans: [],
    dependencies: [],
    links,
    display: {},
    tool: 'pistar.2.1.0',
    istar: '2.0',
  };
  const extent = layOut(model);
  return {
    ...model,
    diagram: {
      width: Math.max(1000, extent?.right ?? 0),
      height: Math.max(700, extent?.bottom ?? 0),
      name: document.header.title?.trim() || modelName,
      customProperties: {
        engine: 'istardt',
        ...Object.fromEntries(
          ['title', 'author', 'source', 'lastUpdated'].flatMap((key) =>
            document.header[key]?.trim()
              ? [[key, document.header[key]!.trim()]]
              : [],
          ),
        ),
      },
    },
    metamodel: istardtMetamodelBlock(),
  };
};
