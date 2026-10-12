/**
 * The variable uses of a goal model's assertions (#58), as facts: each use
 * with its shape (a bare variable or `!x`, `= true`, `= 3`, `> 3`) and the
 * type of the number it is compared with. The goal language's parser reads
 * them (a dialect's prefix, `assertion trigger …`, too). Read by the engines
 * whose conditions are assertions (Edge's, GODA's); `assertions.rls` types
 * them.
 */
import { propertyOf, valueOf, type AnyDialect } from '@goal-controller/dialect';
import { goalServices, parseWith } from '@goal-controller/goal-language';
import type { GoalViewNode } from '@goal-controller/goal-tree';
import { ref, type RefValue } from './facts';
import type { FieldReader } from './goalModel';

/** Every AST node under a root. */
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

const shapeOf = (node: Record<string, unknown>) =>
  node.$type === 'AssertVar'
    ? 'bare'
    : node.$type === 'AssertAssign'
      ? 'eqBool'
      : node.$type === 'AssertCompare'
        ? node.operator === '=' || node.operator === '!='
          ? 'eqNumber'
          : 'ordered'
        : null;

/** Whether an element's property is an assertion, in a dialect. */
export const isAssertion = (
  dialect: Pick<AnyDialect, 'properties'>,
  node: GoalViewNode,
  key: string,
): boolean => {
  const property = propertyOf(dialect, node.kind, key);
  return !!property && valueOf(property, node.properties).type === 'assertion';
};

/** What an assertion's names mean: variables a resource declares, or declared by their first use. */
export type AssertionVariables =
  /** Edge: a variable of this kind (variables.json's), or an element the property may name */
  | { kind: string }
  /** GODA: a context variable (`gm.context`), defined where it is first used */
  | { declaredByUse: true };

/** assertions.rls's checks' messages (`{detail}`: the variable's type, or its name). */
export const ASSERTION_MESSAGES: Readonly<Record<string, string>> = {
  'gm.typeConflict': '`{name}` is used both as a boolean and as a number',
  'gm.orderOnBoolean': '`{name}` is a boolean: compare it with = or !=',
  'gm.boolOnNumber':
    '`{name}` is a number ({detail}): compare it with a number',
  'gm.numberOnBoolean': '`{name}` is a boolean: compare it with true or false',
  'gm.needsBoolean':
    '`{name}` is a number ({detail}): a condition needs a boolean',
  'gm.intWithDecimal': '`{name}` is an int: compared with a decimal',
};

/** The words an assertion may hold that are no variable. */
const WORDS = new Set(['true', 'false', 'assertion', 'condition', 'trigger']);

/**
 * A reader of a dialect's assertion properties. With `declaredByUse`, make
 * one per model read: it remembers the variables already declared.
 */
export const assertionReader = (
  dialect: Pick<AnyDialect, 'properties'>,
  variables: AssertionVariables,
): ((node: GoalViewNode, key: string) => FieldReader | undefined) => {
  const declared = new Set<string>();
  const byUse = 'declaredByUse' in variables;
  return (node, key) => {
    if (!isAssertion(dialect, node, key)) return undefined;
    return (text, c) => {
      // the names this field uses first (GODA declares them here)
      const declares = new Set(
        byUse
          ? [...new Set(text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])].filter(
              (name) => !WORDS.has(name) && !declared.has(name),
            )
          : [],
      );
      declares.forEach((name) => declared.add(name));
      for (const use of nodes(
        parseWith(goalServices(), 'assertion', text).value,
      )) {
        const variable = use.variable as string | undefined;
        const cst = use.$cstNode as { offset: number } | undefined;
        const shape = shapeOf(use);
        if (!variable || !cst || !shape) continue;
        const location = c.at(cst.offset, cst.offset + variable.length);
        let id: string | RefValue;
        if (byUse && declares.has(variable)) {
          declares.delete(variable);
          id = `gm.context:${variable}`;
          c.define({ id, kind: 'gm.context', name: variable, location });
        } else if (byUse) {
          id = ref(c.refer(['gm.context'], variable, location).id!);
        } else {
          const kinds = [variables.kind];
          // an element's id is a condition too (Edge's resources)
          const property = propertyOf(dialect, node.kind, key);
          const value = property && valueOf(property, {});
          if (value?.type === 'assertion')
            for (const kind of value.resolves)
              if (kind !== 'variable') kinds.push(`gm.${kind}`);
          id = ref(c.refer([...new Set(kinds)], variable, location).id!);
        }
        c.relate([byUse ? 'gm_inferred' : 'gm_declared', id]);
        c.relate(['gm_use', id, shape]);
        c.relate(['gm_useName', id, variable]);
        if (use.$type === 'AssertCompare')
          c.relate([
            'gm_literal',
            id,
            String(use.value).includes('.') ? 'decimal' : 'int',
          ]);
      }
    };
  };
};
