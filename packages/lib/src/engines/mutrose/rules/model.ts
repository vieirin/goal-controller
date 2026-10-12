/**
 * MutRoSe's goal model as facts (goal-controller#75): the generic goal-model
 * reader (ids, notation children) with MutRoSe's hooks.
 * - A task's name's first word refers to its HDDL task.
 * - OCL properties: Controls declare variables typed by world classes;
 *   Monitors, Params and Location refer to them; a select declares its own
 *   variable; a forAll iterates a variable; a path's attributes are looked up
 *   in its head's type.
 * The OCL is read as the goal language's OCL tokens, as #63 read it
 * (MutRoSe's own OCL language, #69, could replace the token patterns).
 */
import { propertyOf, valueOf } from '@goal-controller/dialect';
import { goalServices, parseWith } from '@goal-controller/goal-language';
import type { GoalView, GoalViewNode } from '@goal-controller/goal-tree';
import { mutrose } from '../definition';
import {
  ref,
  type DocumentFacts,
  type KindDefinition,
} from '../../ruleFacts/facts';
import {
  type FieldContext,
  type FieldReader,
  type ModelHooks,
} from '../../ruleFacts/goalModel';

export const MUTROSE_MODEL_KINDS: Readonly<Record<string, KindDefinition>> = {
  // resolved by model.rls: a field's own (a select's) first, else a Controls one
  'gm.variable': { label: 'variable', scope: 'rules' },
};

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

/** A task's name's first word: the HDDL task it stands for. */
const taskName: FieldReader = (text, c) => {
  const word = /^\s*([A-Za-z_][\w-]*)/.exec(text);
  if (c.node.kind !== 'task' || !word) return;
  const from = word[0].length - word[1]!.length;
  const task = c.refer(
    ['hddl.task'],
    word[1]!,
    c.at(from, from + word[1]!.length),
  );
  c.relate(['gm_namesTask', c.self, ref(task.id!)]);
};

/** An OCL property's facts. */
const ocl =
  (key: string): FieldReader =>
  (text: string, c: FieldContext) => {
    const tokens = leaves(
      parseWith(goalServices(), 'ocl', text).value.$cstNode as Cst | undefined,
    );
    const at = (t: Token) => c.at(t.from, t.to);
    const variable = (t: Token) => c.refer(['gm.variable'], t.text, at(t));
    const worldClass = (t: Token) => c.refer(['world.class'], t.text, at(t));
    /** `Sequence(Request)` or `Request` from token i: the class token */
    const typeAt = (i: number) => {
      const head = tokens[i];
      if (head && tokens[i + 1]?.text === '(' && tokens[i + 3]?.text === ')')
        return {
          type: `${head.text}(${tokens[i + 2]!.text})`,
          class: tokens[i + 2],
          end: i + 4,
        };
      return { type: head?.text ?? '', class: head, end: i + 1 };
    };
    if (key === 'Controls') {
      for (let i = 0; i < tokens.length; i += 1) {
        const name = tokens[i]!;
        if (!NAME.test(name.text) || tokens[i + 1]?.text !== ':') continue;
        const { type, class: cls, end } = typeAt(i + 2);
        c.define({
          id: `gm.variable:${c.node.key}/${name.text}`,
          kind: 'gm.variable',
          name: name.text,
          location: at(name),
          type,
        });
        if (cls && NAME.test(cls.text)) worldClass(cls);
        i = end - 1;
      }
      return;
    }
    if (['Monitors', 'Params', 'Location'].includes(key)) {
      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i]!;
        if (!NAME.test(token.text)) continue;
        const reference = variable(token);
        if (key === 'Params')
          c.relate(['gm_param', c.self, ref(reference.id!)]);
        // `rooms : Sequence(Room)`, as some models write their Monitors
        if (tokens[i + 1]?.text === ':') {
          const { class: cls, end } = typeAt(i + 2);
          if (cls && NAME.test(cls.text)) worldClass(cls);
          i = end - 1;
        }
      }
      return;
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
        const id = `gm.variable:${c.document}/${token.text}`;
        c.define({
          id,
          kind: 'gm.variable',
          name: token.text,
          location: at(token),
          type,
        });
        c.relate(['gm_binder', id, c.document]);
        if (cls && NAME.test(cls.text))
          c.relate(['gm_selects', ref(worldClass(cls).id!)]);
        i = end - 1;
        continue;
      }
      // a path: a variable (or the world's root), then attributes of its type
      let previous = c.refer(
        ['gm.variable', 'world.root'],
        token.text,
        at(token),
      );
      if (tokens[i + 1]?.text === '->' && tokens[i + 2]?.text === 'forAll')
        c.relate(['gm_iterates', ref(previous.id!)]);
      while (
        tokens[i + 1]?.text === '.' &&
        tokens[i + 2] &&
        NAME.test(tokens[i + 2]!.text)
      ) {
        const attribute = tokens[i + 2]!;
        previous = c.refer(['world.attribute'], attribute.text, at(attribute), {
          via: previous,
          through: 'type',
        });
        i += 2;
      }
    }
  };

const isOcl = (node: GoalViewNode, key: string) => {
  const property = propertyOf(mutrose, node.kind, key);
  return !!property && valueOf(property, node.properties).type === 'ocl';
};

export const MUTROSE_MODEL_HOOKS: ModelHooks = {
  name: taskName,
  field: (node, key) => (isOcl(node, key) ? ocl(key) : undefined),
};

/**
 * Another goal model of the project (a domain may be shared by several): its
 * tasks' names, as uses of the HDDL tasks; nothing else of it.
 */
export const readOtherModel = (
  document: string,
  view: GoalView,
): DocumentFacts[] =>
  [...view.nodes.values()]
    .filter((node) => node.kind === 'task')
    .map((node) => {
      const field = `${document}:${node.key}:name`;
      const word = /^\s*([A-Za-z_][\w-]*)/.exec(node.name);
      const from = word ? word[0].length - word[1]!.length : 0;
      return {
        document: field,
        text: node.name,
        definitions: [],
        references: word
          ? [
              {
                kinds: ['hddl.task'],
                name: word[1]!,
                location: { document: field, from, to: from + word[1]!.length },
                id: 'm0',
              },
            ]
          : [],
      };
    });
