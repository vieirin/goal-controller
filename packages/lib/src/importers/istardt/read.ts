/**
 * An iStarDT-X file (`.istardt`, `.istardtx`: cmg-york/istardt's XSD and
 * BNF at `649c9be`) as a document: the header, the options and the one
 * actor's goals, tasks with their effects, qualities, condition boxes,
 * predicates, variables and sets, each in the file's order. Read with lib's
 * XML reader.
 *
 * Formulas are read as the translator's xmlparser reads them: through
 * Jackson, which groups an element's children by tag name in the order each
 * name first appears (`<add><qualID/><multiply/><qualID/>` is `qualID,
 * qualID, multiply`). Sums and products are commutative, so nothing changes
 * but the order the output writes them in, which is the translator's.
 */
import {
  readXml,
  type XmlElement,
} from '@goal-controller/goal-language/formats';
import type { ImportDiagnostic } from '../types';

/** A formula, as the file's tree (the BNF's boolean and numeric expressions). */
export type Formula =
  | { op: 'number'; value: string }
  | { op: 'bool'; value: string }
  | { op: 'atom'; tag: string; name: string }
  | { op: 'previous'; tag: string; name: string }
  | { op: 'add' | 'multiply' | 'and' | 'or'; args: Formula[] }
  | {
      op: 'subtract' | 'divide' | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
      left: Formula;
      right: Formula;
    }
  | { op: 'not' | 'negate'; arg: Formula };

export type DocumentGoal = {
  name: string;
  description: string;
  root: boolean;
  terminal: boolean;
  episodeLength: string;
  relation: 'AND' | 'OR' | null;
  /** the child goals', then the child tasks' names, as the translator reads them */
  children: { kind: 'goal' | 'task'; ref: string }[];
  pre: Formula | null;
  npr: Formula | null;
};

export type DocumentEffect = {
  name: string;
  description: string;
  satisfying: boolean;
  probability: string;
  turnsTrue: string[];
  turnsFalse: string[];
  set: { variable: string; value: string }[];
  pre: Formula | null;
  npr: Formula | null;
};

export type DocumentTask = {
  name: string;
  description: string;
  effects: DocumentEffect[];
  pre: Formula | null;
  npr: Formula | null;
};

export type DocumentNamed = {
  name: string;
  description: string;
  formula: Formula | null;
};

export type IstardtDocument = {
  header: Record<string, string>;
  options: Record<string, string>;
  actor: { name: string; description: string };
  goals: DocumentGoal[];
  tasks: DocumentTask[];
  qualities: (DocumentNamed & { root: boolean })[];
  conditions: DocumentNamed[];
  predicates: { name: string; description: string }[];
  variables: { name: string; description: string }[];
  crossRun: string[];
  exported: {
    ref: string;
    continuous: boolean;
    minVal?: string;
    maxVal?: string;
  }[];
  initializations: { ref: string; value: string }[];
};

const ATOMS = [
  'predicateID',
  'goalID',
  'taskID',
  'effectID',
  'conditionID',
  'variableID',
  'qualID',
];
const MULTI = ['add', 'multiply', 'and', 'or'];
const BINARY = ['subtract', 'divide', 'gt', 'gte', 'lt', 'lte', 'eq', 'neq'];
const FORMULA_TAGS = new Set([
  'numConst',
  'boolConst',
  ...ATOMS,
  ...MULTI,
  ...BINARY,
  'not',
  'negate',
  'previous',
]);

/** Children grouped by tag, each group where its name first appears (Jackson). */
const grouped = (children: readonly XmlElement[]): XmlElement[] => {
  const groups = new Map<string, XmlElement[]>();
  for (const child of children)
    groups.set(child.name, [...(groups.get(child.name) ?? []), child]);
  return [...groups.values()].flat();
};

const local = (name: string) => name.slice(name.indexOf(':') + 1);

export const readIstardtDocument = (
  text: string,
): { document: IstardtDocument | null; diagnostics: ImportDiagnostic[] } => {
  const diagnostics: ImportDiagnostic[] = [];
  const { root, problems } = readXml(text);
  for (const problem of problems)
    diagnostics.push({ severity: 'error', message: problem.message });
  if (!root || local(root.name) !== 'iStarDT') {
    diagnostics.push({
      severity: 'error',
      message: root
        ? `Not an iStarDT-X file: its root is <${root.name}>, not <iStarDT>`
        : 'Not an iStarDT-X file: no XML element',
    });
    return { document: null, diagnostics };
  }
  const warn = (message: string) =>
    diagnostics.push({ severity: 'warning', message });

  const child = (element: XmlElement | undefined, name: string) =>
    element?.children.find((c) => local(c.name) === name);
  const all = (element: XmlElement | undefined, name: string) =>
    element?.children.filter((c) => local(c.name) === name) ?? [];
  const attribute = (element: XmlElement, name: string, fallback = '') =>
    element.attributes[name]?.trim() ?? fallback;

  const formula = (element: XmlElement): Formula | null => {
    const tag = local(element.name);
    if (tag === 'numConst') return { op: 'number', value: element.text };
    if (tag === 'boolConst') return { op: 'bool', value: element.text };
    if (ATOMS.includes(tag)) return { op: 'atom', tag, name: element.text };
    if (tag === 'previous') {
      const atom = element.children.find((c) => ATOMS.includes(local(c.name)));
      if (!atom) {
        warn('a <previous> without an element: left out');
        return null;
      }
      return { op: 'previous', tag: local(atom.name), name: atom.text };
    }
    if (MULTI.includes(tag)) {
      const args = operands(element);
      if (args.length < 2)
        warn(
          `an <${tag}> with ${args.length} operand(s): read as ${args.length ? 'its operand' : 'nothing'}`,
        );
      if (args.length === 1) return args[0]!;
      if (!args.length) return null;
      return { op: tag as 'add', args };
    }
    if (BINARY.includes(tag)) {
      const side = (name: string) => {
        const wrapper = child(element, name);
        const inner = wrapper && operands(wrapper)[0];
        if (!inner) warn(`a <${tag}> without its <${name}>: left out`);
        return inner;
      };
      const left = side('left');
      const right = side('right');
      return left && right ? { op: tag as 'subtract', left, right } : null;
    }
    if (tag === 'not' || tag === 'negate') {
      const arg = operands(element)[0];
      if (!arg) {
        warn(`a <${tag}> without an operand: left out`);
        return null;
      }
      return { op: tag, arg };
    }
    return null;
  };
  /** An element's formula children, as Jackson orders them. */
  const operands = (element: XmlElement): Formula[] =>
    grouped(element.children.filter((c) => FORMULA_TAGS.has(local(c.name))))
      .map(formula)
      .filter((f): f is Formula => f !== null);
  const formulaIn = (element: XmlElement | undefined) =>
    element ? (operands(element)[0] ?? null) : null;

  const header = child(root, 'header');
  const options = child(root, 'options');
  const actors = all(child(root, 'actors'), 'actor');
  if (actors.length !== 1)
    diagnostics.push({
      severity: actors.length ? 'warning' : 'error',
      message: actors.length
        ? `iStar-DT has one actor: the first of ${actors.length} is read`
        : 'The file has no actor',
    });
  const actor = actors[0];
  if (!actor) return { document: null, diagnostics };

  const goals = all(child(actor, 'goals'), 'goal').map((goal): DocumentGoal => {
    const refinement = child(goal, 'refinement');
    const type = refinement && attribute(refinement, 'type').toUpperCase();
    return {
      name: attribute(goal, 'name'),
      description: attribute(goal, 'description'),
      root: attribute(goal, 'root') === 'true',
      terminal: attribute(goal, 'terminal') === 'true',
      episodeLength: attribute(goal, 'episodeLength', '1'),
      relation: type === 'AND' || type === 'OR' ? type : null,
      children: [
        ...all(refinement, 'childGoal').map((c) => ({
          kind: 'goal' as const,
          ref: attribute(c, 'ref'),
        })),
        ...all(refinement, 'childTask').map((c) => ({
          kind: 'task' as const,
          ref: attribute(c, 'ref'),
        })),
      ],
      pre: formulaIn(child(goal, 'pre')),
      npr: formulaIn(child(goal, 'npr')),
    };
  });

  const tasks = all(child(actor, 'tasks'), 'task').map(
    (task): DocumentTask => ({
      name: attribute(task, 'name'),
      description: attribute(task, 'description'),
      effects: all(child(task, 'effectGroup'), 'effect').map((effect) => ({
        name: attribute(effect, 'name'),
        description: attribute(effect, 'description'),
        satisfying: attribute(effect, 'satisfying', 'true') !== 'false',
        probability: attribute(effect, 'probability', '1.0'),
        turnsTrue: all(effect, 'turnsTrue').map((t) => t.text),
        turnsFalse: all(effect, 'turnsFalse').map((t) => t.text),
        set: all(effect, 'set').map((set) => ({
          variable: child(set, 'variableID')?.text ?? '',
          value: child(set, 'numConst')?.text ?? '',
        })),
        pre: formulaIn(child(effect, 'pre')),
        npr: formulaIn(child(effect, 'npr')),
      })),
      pre: formulaIn(child(task, 'pre')),
      npr: formulaIn(child(task, 'npr')),
    }),
  );

  const named = (element: XmlElement): DocumentNamed => ({
    name: attribute(element, 'name'),
    description: attribute(element, 'description'),
    formula: formulaIn(element),
  });
  const qualities = all(child(actor, 'qualities'), 'quality').map((q) => ({
    ...named(q),
    root: attribute(q, 'root') === 'true',
  }));
  const conditions = all(child(actor, 'condBoxes'), 'condBox').map(named);
  const declared = (set: string, item: string) =>
    all(child(actor, set), item).map((p) => ({
      name: p.text,
      description: attribute(p, 'description'),
    }));

  const idIn = (element: XmlElement) =>
    element.children.find((c) => ATOMS.includes(local(c.name)))?.text ?? '';
  const crossRun = all(child(actor, 'crossRuns'), 'crossRun').map(idIn);
  const exported = all(child(actor, 'exportedSet'), 'export').map(
    (exported) => {
      const continuous = attribute(exported, 'continuous') === 'true';
      return {
        ref: idIn(exported),
        continuous,
        ...(continuous && {
          minVal: attribute(exported, 'minVal', '0'),
          maxVal: attribute(exported, 'maxVal', '0'),
        }),
      };
    },
  );
  const initializations = all(
    child(actor, 'initializations'),
    'initialization',
  ).map((init) => ({ ref: attribute(init, 'element'), value: init.text }));

  return {
    document: {
      header: header ? { ...header.attributes } : {},
      options: options ? { ...options.attributes } : {},
      actor: {
        name: attribute(actor, 'name'),
        description: attribute(actor, 'description'),
      },
      goals,
      tasks,
      qualities,
      conditions,
      predicates: declared('predicates', 'predicate'),
      variables: declared('variables', 'variable'),
      crossRun,
      exported,
      initializations,
    },
    diagnostics,
  };
};
