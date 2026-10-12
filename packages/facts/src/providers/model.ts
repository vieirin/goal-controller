/**
 * The goal model, read from its view (goal-tree's GoalView) field by field:
 * one document per element field, `model:<key>:id|name|notation|<property>`,
 * so an edit re-extracts that field alone. Its locations are offsets in the
 * field's text; the workbench maps them onto the Notation line or the
 * inspector field.
 *
 * - `id`: the element (`gm.goal`, `gm.task`, …), a member of its parent;
 * - `notation`: the ids it lists, references among its children;
 * - `name`: in MutRoSe, a task's first word refers to its HDDL task;
 * - OCL properties (MutRoSe): Controls declare variables typed by world
 *   classes; Monitors, Params and Location refer to them; a select or
 *   forAll's paths refer to variables, then to attributes of their types;
 * - assertion properties (#58): each variable use, with its shape (a bare
 *   variable, `= true`, `= 3`, `> 3`) and its literal's type, referring to
 *   the variables a project resource declares (Edge), or declared by their
 *   first use (GODA).
 *
 * Every text is read with the goal language's Langium parser: the
 * assertion's AST, the OCL value's CST tokens, the notation's references.
 */
import {
  propertyOf,
  valueOf,
  type AnyDialect,
  type ValueConfig,
} from '@goal-controller/dialect';
import {
  goalServices,
  parseWith,
  withoutBracketSpaces,
} from '@goal-controller/goal-language';
import type { GoalView, GoalViewNode } from '@goal-controller/goal-tree';
import {
  ref,
  type PoolDocument,
  type PoolFacts,
  type PoolLocation,
  type PoolProvider,
  type PoolRef,
  type PoolReference,
} from '../core/types';

export type ModelOptions = {
  definition: AnyDialect;
  /** MutRoSe: a task's name's first word refers to an HDDL task */
  taskNames?: boolean;
  /**
   * where assertion variables are defined: by a provider's kind (Edge's
   * `edge.variable`, from variables.json), or by their first use (GODA)
   */
  variables?: { kind: string } | 'uses';
};

/** What a field document carries besides its text. */
type Field = {
  key: string;
  kind: string;
  field: string;
  parent: string | null;
  /** an assertion's or OCL value's type, for a property */
  value?: 'assertion' | 'ocl';
  /** GODA: the variables first used in this field */
  declares?: string[];
  /** an element's declared type (Edge's resources: `{int 0..5 = 3}`) */
  type?: string;
  /** a field of another model of the project: only its uses of other files count */
  other?: true;
};

const elementId = (key: string) => `gm:${key}`;

/** A CST node, as far as reading tokens goes. */
type Cst = {
  offset: number;
  length: number;
  text: string;
  hidden?: boolean;
  content?: Cst[];
};
type Token = { text: string; from: number; to: number };

const leaves = (node: Cst | undefined, out: Token[] = []): Token[] => {
  if (!node) return out;
  if (node.content) node.content.forEach((child) => leaves(child, out));
  else if (!node.hidden && node.length)
    out.push({
      text: node.text,
      from: node.offset,
      to: node.offset + node.length,
    });
  return out;
};

/** Every AST node under a root, by `$type`. */
const nodes = (root: unknown, out: Record<string, unknown>[] = []) => {
  if (root && typeof root === 'object') {
    const node = root as Record<string, unknown>;
    if (typeof node.$type === 'string') out.push(node);
    for (const [key, value] of Object.entries(node))
      if (!key.startsWith('$'))
        (Array.isArray(value) ? value : [value]).forEach((v) => nodes(v, out));
  }
  return out;
};

const OCL_WORDS = new Set([
  'select',
  'forAll',
  'exists',
  'collect',
  'reject',
  'in',
  'not',
  'and',
  'or',
  'assertion',
  'condition',
  'trigger',
  'true',
  'false',
  'True',
  'False',
  'Sequence',
  'Set',
  'Bag',
]);
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ASSERTION_WORDS = new Set([
  'true',
  'false',
  'assertion',
  'condition',
  'trigger',
]);

const valueType = (
  definition: AnyDialect,
  node: GoalViewNode,
  key: string,
): ValueConfig['type'] | undefined => {
  const property = propertyOf(definition, node.kind, key);
  return property ? valueOf(property, node.properties).type : undefined;
};

export const modelProvider = (options: ModelOptions): PoolProvider => {
  const { definition } = options;
  const variableKind =
    options.variables === undefined
      ? null
      : options.variables === 'uses'
        ? 'gm.context'
        : options.variables.kind;
  return {
    id: 'gm',
    // the project's other goal models (MutRoSe's shared domains) count as uses
    documents: { model: true, resources: ['otherModel'] },
    kinds: {
      goal: { label: 'goal' },
      task: { label: 'task' },
      resource: { label: 'resource' },
      quality: { label: 'quality' },
      // a notation's id: among the element's children, of any kind
      child: { label: 'child', scope: 'rules' },
      variable: { label: 'variable', scope: 'rules' },
      context: { label: 'context variable' },
    },
    refers: [
      'gm.child',
      'gm.variable',
      ...(options.taskNames
        ? ['hddl.task', 'world.class', 'world.attribute', 'world.root']
        : []),
      ...(variableKind ? [variableKind] : []),
    ],

    split: ({ id, kind, value }) => {
      const view = value as GoalView;
      const parts: PoolDocument[] = [];
      if (kind === 'otherModel') {
        if (options.taskNames)
          for (const node of view.nodes.values())
            if (node.kind === 'task')
              parts.push({
                id: `${id}:${node.key}:name`,
                kind: 'model',
                text: node.name,
                value: {
                  key: node.key,
                  kind: node.kind,
                  field: 'name',
                  parent: null,
                  other: true,
                } satisfies Field,
              });
        return parts;
      }
      const declared = new Set<string>();
      for (const node of view.nodes.values()) {
        const field = (
          name: string,
          text: string,
          extra: Partial<Field> = {},
        ) =>
          parts.push({
            id: `model:${node.key}:${name}`,
            kind: 'model',
            text,
            value: {
              key: node.key,
              kind: node.kind,
              field: name,
              parent: node.parent,
              ...extra,
            } satisfies Field,
          });
        const elementType = node.properties.type;
        field(
          'id',
          node.id,
          elementType
            ? { type: elementType === 'bool' ? 'boolean' : elementType }
            : {},
        );
        field('name', node.name);
        if (node.notation) field('notation', node.notation);
        for (const [key, text] of Object.entries(node.properties)) {
          const type = valueType(definition, node, key);
          if (type === 'ocl') field(key, text, { value: 'ocl' });
          if (type === 'assertion') {
            // GODA: a variable is declared where it is first used
            const declares =
              options.variables === 'uses'
                ? [
                    ...new Set(text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []),
                  ].filter(
                    (name) => !ASSERTION_WORDS.has(name) && !declared.has(name),
                  )
                : [];
            declares.forEach((name) => declared.add(name));
            field(key, text, { value: 'assertion', declares });
          }
        }
      }
      return parts;
    },

    extract: (document) => {
      const facts: Required<PoolFacts> = {
        definitions: [],
        references: [],
        relations: [],
      };
      const field = document.value as Field;
      const text = document.text ?? '';
      const self = elementId(field.key);
      const at = (from: number, to: number): PoolLocation => ({
        document: document.id,
        from,
        to,
      });
      let counter = 0;
      const refer = (
        kinds: string[],
        name: string,
        location: PoolLocation,
        scope?: PoolReference['scope'],
      ) => {
        const reference: PoolReference = {
          kinds,
          name,
          location,
          id: `m${counter++}`,
          ...(scope && { scope }),
        };
        facts.references.push(reference);
        return reference;
      };

      if (field.field === 'id') {
        facts.definitions.push({
          id: self,
          kind: `gm.${field.kind}`,
          name: text,
          location: at(0, text.length),
          ...(field.parent && { owner: elementId(field.parent) }),
          ...(field.type && { type: field.type }),
        });
        facts.relations.push(['gm.element', self]);
        return facts;
      }

      if (field.field === 'name') {
        const word = /^\s*([A-Za-z_][\w-]*)/.exec(text);
        if (options.taskNames && field.kind === 'task' && word) {
          const from = word[0].length - word[1]!.length;
          const task = refer(
            ['hddl.task'],
            word[1]!,
            at(from, from + word[1]!.length),
          );
          if (!field.other)
            facts.relations.push(['gm.namesTask', self, ref(task.id!)]);
        }
        return facts;
      }

      if (field.field === 'notation') {
        // read as an element line's bracket (without its spaces, where the
        // dialect ignores them: GODA's `T1.1 2` is T1.12): its RtRef nodes
        const prefix = 'X1: x [';
        const line = `${prefix}${text}]`;
        const read =
          definition.notation?.whitespace === 'ignore'
            ? withoutBracketSpaces(line)
            : { text: line, origin: (offset: number) => offset };
        const parsed = parseWith(goalServices(), 'elementLine', read.text);
        const written = (from: number, length: number) => {
          const start = read.origin(from) - prefix.length;
          return at(start, read.origin(from + length - 1) + 1 - prefix.length);
        };
        const refs = parsed.parserErrors.length
          ? [...read.text.matchAll(/[A-Z]+\d[\d.]*X?|[A-Z]+X/g)].map((m) => ({
              id: m[0],
              from: m.index!,
            }))
          : nodes(parsed.value)
              .filter((n) => n.$type === 'RtRef')
              .map((n) => {
                const reference = n.ref as { $refText: string; $refNode?: Cst };
                return {
                  id: reference.$refText,
                  from: reference.$refNode?.offset ?? 0,
                };
              });
        for (const { id, from } of refs)
          if (from >= prefix.length)
            refer(['gm.child'], id, written(from, id.length), { owner: self });
        return facts;
      }

      if (field.value === 'assertion') {
        const parsed = parseWith(goalServices(), 'assertion', text);
        const declares = new Set(field.declares ?? []);
        for (const node of nodes(parsed.value)) {
          const variable = node.variable as string | undefined;
          const cst = node.$cstNode as Cst | undefined;
          if (!variable || !cst) continue;
          const shape =
            node.$type === 'AssertVar'
              ? 'bare'
              : node.$type === 'AssertAssign'
                ? 'eqBool'
                : node.$type === 'AssertCompare'
                  ? ['=', '!='].includes(node.operator as string)
                    ? 'eqNumber'
                    : 'ordered'
                  : null;
          if (!shape) continue;
          const location = at(cst.offset, cst.offset + variable.length);
          // the use: GODA's first one defines the variable, any other refers to it
          let use: string | PoolRef;
          if (options.variables === 'uses' && declares.has(variable)) {
            declares.delete(variable);
            use = `gm.context:${variable}`;
            facts.definitions.push({
              id: use,
              kind: 'gm.context',
              name: variable,
              location,
              detail: 'declared by its first use',
            });
          } else if (variableKind) {
            const kinds = [variableKind];
            // an element's id is a condition too (Edge's resources)
            const property = propertyOf(definition, field.kind, field.field);
            const value = property && valueOf(property, {});
            if (value?.type === 'assertion')
              for (const kind of value.resolves)
                if (kind !== 'variable') kinds.push(`gm.${kind}`);
            use = ref(refer([...new Set(kinds)], variable, location).id!);
          } else continue;
          facts.relations.push(
            [options.variables === 'uses' ? 'gm.inferred' : 'gm.declared', use],
            ['gm.use', use, shape],
            ['gm.useName', use, variable],
          );
          const literal =
            node.$type === 'AssertCompare' ? String(node.value) : null;
          if (literal)
            facts.relations.push([
              'gm.literal',
              use,
              literal.includes('.') ? 'decimal' : 'int',
            ]);
        }
        return facts;
      }

      if (field.value === 'ocl') {
        const tokens = leaves(
          parseWith(goalServices(), 'ocl', text).value.$cstNode as
            | Cst
            | undefined,
        );
        const variable = (t: Token) =>
          refer(['gm.variable'], t.text, at(t.from, t.to));
        const worldClass = (t: Token) =>
          refer(['world.class'], t.text, at(t.from, t.to));
        /** `Sequence(Request)` or `Request` from token i: the class token */
        const typeAt = (
          i: number,
        ): { type: string; class: Token | undefined; end: number } => {
          const head = tokens[i];
          if (
            head &&
            tokens[i + 1]?.text === '(' &&
            tokens[i + 3]?.text === ')'
          )
            return {
              type: `${head.text}(${tokens[i + 2]!.text})`,
              class: tokens[i + 2],
              end: i + 4,
            };
          return { type: head?.text ?? '', class: head, end: i + 1 };
        };
        if (field.field === 'Controls') {
          for (let i = 0; i < tokens.length; i += 1) {
            const name = tokens[i]!;
            if (!NAME.test(name.text) || tokens[i + 1]?.text !== ':') continue;
            const { type, class: cls, end } = typeAt(i + 2);
            facts.definitions.push({
              id: `gm.variable:${field.key}/${name.text}`,
              kind: 'gm.variable',
              name: name.text,
              location: at(name.from, name.to),
              type,
              detail: `controlled by ${field.key}`,
            });
            if (cls && NAME.test(cls.text)) worldClass(cls);
            i = end - 1;
          }
          return facts;
        }
        if (['Monitors', 'Params', 'Location'].includes(field.field)) {
          for (let i = 0; i < tokens.length; i += 1) {
            const token = tokens[i]!;
            if (!NAME.test(token.text)) continue;
            const reference = variable(token);
            if (field.field === 'Params')
              facts.relations.push(['gm.param', self, ref(reference.id!)]);
            // `rooms : Sequence(Room)`, as some models write their Monitors
            if (tokens[i + 1]?.text === ':') {
              const { class: cls, end } = typeAt(i + 2);
              if (cls && NAME.test(cls.text)) worldClass(cls);
              i = end - 1;
            }
          }
          return facts;
        }
        // an expression: selects, forAlls and paths
        for (let i = 0; i < tokens.length; i += 1) {
          const token = tokens[i]!;
          if (
            !NAME.test(token.text) ||
            OCL_WORDS.has(token.text) ||
            tokens[i - 1]?.text === '.'
          )
            continue;
          // `select(r:Request | …)`: r declared here, typed by a class
          if (
            tokens[i - 1]?.text === '(' &&
            tokens[i - 2]?.text === 'select' &&
            tokens[i + 1]?.text === ':'
          ) {
            const { type, class: cls, end } = typeAt(i + 2);
            const id = `gm.variable:${document.id}/${token.text}`;
            facts.definitions.push({
              id,
              kind: 'gm.variable',
              name: token.text,
              location: at(token.from, token.to),
              type,
              detail: 'select variable',
            });
            facts.relations.push(['gm.binder', id, document.id]);
            if (cls && NAME.test(cls.text))
              facts.relations.push(['gm.selects', ref(worldClass(cls).id!)]);
            i = end - 1;
            continue;
          }
          // a path: a variable (or the world's root), then attributes of its type
          let previous = refer(
            ['gm.variable', 'world.root'],
            token.text,
            at(token.from, token.to),
          );
          if (tokens[i + 1]?.text === '->' && tokens[i + 2]?.text === 'forAll')
            facts.relations.push(['gm.iterates', ref(previous.id!)]);
          while (
            tokens[i + 1]?.text === '.' &&
            tokens[i + 2] &&
            NAME.test(tokens[i + 2]!.text)
          ) {
            const attribute = tokens[i + 2]!;
            previous = refer(
              ['world.attribute'],
              attribute.text,
              at(attribute.from, attribute.to),
              {
                via: previous,
                through: 'type',
              },
            );
            i += 2;
          }
        }
        return facts;
      }
      return facts;
    },

    rules: `
      % a notation's id: one of the element's children
      resolves(R, S) :- refers(R, 'gm.child', N), scope(R, O), owns(O, S), defines(S, _, N), gm.element(S).

      % an OCL variable: one its field declares (a select's), else a Controls one
      gm.local(R, S) :- refers(R, 'gm.variable', N), in(R, D), gm.binder(S, D), defines(S, 'gm.variable', N).
      gm.isLocal(R) :- gm.local(R, _).
      gm.binderSymbol(S) :- gm.binder(S, _).
      resolves(R, S) :- gm.local(R, S).
      resolves(R, S) :- refers(R, 'gm.variable', N), !gm.isLocal(R), defines(S, 'gm.variable', N), !gm.binderSymbol(S).

      % #58: a use's type, declared (what it resolves to) or inferred from every use
      gm.numeric(int).
      gm.numeric(number).
      gm.typeOfUse(U, T) :- gm.declared(U), resolves(U, S), typeOf(S, T).
      % an element is a boolean, unless it declares a type (Edge's int resources)
      gm.typedElement(S) :- gm.element(S), typeOf(S, _).
      gm.typeOfUse(U, boolean) :- gm.declared(U), resolves(U, S), gm.element(S), !gm.typedElement(S).
      gm.usedAs(N, boolean) :- gm.inferred(U), gm.use(U, bare), gm.useName(U, N).
      gm.usedAs(N, boolean) :- gm.inferred(U), gm.use(U, eqBool), gm.useName(U, N).
      gm.usedAs(N, number) :- gm.inferred(U), gm.use(U, ordered), gm.useName(U, N).
      gm.usedAs(N, number) :- gm.inferred(U), gm.use(U, eqNumber), gm.useName(U, N).
      gm.conflict(N) :- gm.usedAs(N, boolean), gm.usedAs(N, number).
      gm.typeOfUse(U, T) :- gm.inferred(U), gm.useName(U, N), gm.usedAs(N, T), !gm.conflict(N).

      problem(U, error, 'gm.typeConflict', N) :- gm.inferred(U), gm.useName(U, N), gm.conflict(N).
      problem(U, error, 'gm.orderOnBoolean', '') :- gm.use(U, ordered), gm.typeOfUse(U, boolean).
      problem(U, error, 'gm.boolOnNumber', T) :- gm.use(U, eqBool), gm.typeOfUse(U, T), gm.numeric(T).
      problem(U, error, 'gm.numberOnBoolean', '') :- gm.use(U, eqNumber), gm.typeOfUse(U, boolean).
      problem(U, error, 'gm.needsBoolean', T) :- gm.use(U, bare), gm.typeOfUse(U, T), gm.numeric(T).
      problem(U, warning, 'gm.intWithDecimal', '') :- gm.literal(U, decimal), gm.typeOfUse(U, int).
    `,
    messages: {
      'gm.typeConflict': '`{name}` is used both as a boolean and as a number',
      'gm.orderOnBoolean': '`{name}` is a boolean: compare it with = or !=',
      'gm.boolOnNumber':
        '`{name}` is a number ({arg}): compare it with a number',
      'gm.numberOnBoolean':
        '`{name}` is a boolean: compare it with true or false',
      'gm.needsBoolean':
        '`{name}` is a number ({arg}): a condition needs a boolean',
      'gm.intWithDecimal': '`{name}` is an int: compared with a decimal',
    },
  };
};
