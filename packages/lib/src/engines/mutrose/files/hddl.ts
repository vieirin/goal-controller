/**
 * MutRoSe's HDDL domain (`hddl/*.hddl`), in HDDL's grammar
 * (../hddl/hddl.langium): its types, predicates, functions, tasks, methods
 * and actions define what their names say, its parameters are their
 * operation's (a quantifier's, its own), and its cross-references refer.
 * MutRoSe's domains use types they don't list (`robot`): a type is also
 * declared by its first use.
 */
import { defineFile, type Occurrence } from '../../../pool';
import { defines, langium } from '../pool/vocabulary';
import type { Parameter, VariableGroup } from '../hddl/generated/ast';
import { hddlServices } from '../hddl';

/** a parameter's type: its group's (`object` when none is written) */
const parameterType = (occurrences: readonly Occurrence[]) => {
  const group = (occurrences[0]?.parent as Parameter | undefined)
    ?.$container as VariableGroup | undefined;
  return group?.type?.type?.$refText ?? 'object';
};

export const hddl = defineFile({
  kind: 'hddl',
  extensions: ['.hddl'],
  parser: langium(hddlServices(), {
    kinds: {
      TypeDecl: 'hddl.type',
      Predicate: 'hddl.predicate',
      FunctionDecl: 'hddl.function',
      Task: 'hddl.task',
      Method: 'hddl.method',
      Action: 'hddl.action',
      Parameter: 'hddl.param',
    },
    // a quantifier's variables hide its operation's
    scopes: ['Quantified'],
    annotate: {
      Parameter: {
        name: [defines('hddl.param', { type: parameterType })],
      },
      // a type the domain doesn't list: declared where first used
      TypeRef: {
        type: (node) =>
          node.object ? [] : [defines('hddl.type', { firstUse: true })],
      },
    },
  }),
});
