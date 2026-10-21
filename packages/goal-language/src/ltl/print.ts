/**
 * The LTL AST (./ast.ts), back to text: each node reuses the spelling it was
 * read with (`Surface`). Not the actual document writer — a `formula`
 * value's text is stored and written back verbatim regardless (as `ocl` and
 * `text` values are), so the stress corpus is untouched by anything here.
 * `printLtl` exists to prove the AST is faithful: parse, print, re-parse,
 * compare. Internal whitespace is not preserved token-for-token (the source
 * corpus wraps a `formalspec` over several indented lines); `printLtl`
 * normalizes runs of whitespace to one space, so "byte-identical" in the
 * corpus test (goal-controller#211) means identical modulo that
 * normalization, not the original line breaks and indentation.
 */
import type { Bound, LtlNode, TimeAmount } from './ast.js';

const durationText = (amounts: readonly TimeAmount[]): string =>
  amounts.map((a) => `${a.amount} ${a.unit}`).join(' ');

const symbolicBoundText = (bound: Bound): string =>
  (bound.comparator === '<=' ? '≤' : '≥') + durationText(bound.duration);

/** the `, before, 2 minutes,` clause after `sooner-or-later`/`eventually`/`until` */
const eventuallyBoundClause = (bound: Bound): string => {
  if (bound.surface === 'symbolic') return symbolicBoundText(bound);
  const word = bound.qualifier ?? 'in';
  return `, ${bound.strictly ? 'strictly ' : ''}${word} ${durationText(bound.duration)}, `;
};

/** the `, for 2 minutes,` / `, for more than, 2 minutes,` clause after `always`/`globally`, or before `unless` */
const globallyBoundClause = (bound: Bound): string => {
  if (bound.surface === 'symbolic') return symbolicBoundText(bound);
  const qualifierText =
    bound.qualifier === 'moreThan'
      ? `${bound.strictly ? 'strictly ' : ''}more than `
      : bound.qualifier === 'lessThan'
        ? `${bound.strictly ? 'strictly ' : ''}less than `
        : '';
  return `, for ${qualifierText}${durationText(bound.duration)}, `;
};

const print = (node: LtlNode): string => {
  switch (node.kind) {
    case 'forall':
    case 'exists': {
      const vars = node.variables.map((v) => `${v.name}: ${v.type}`).join(', ');
      return node.surface === 'sugar'
        ? `${node.kind === 'forall' ? 'forall' : 'exists'} ${vars} . ${print(node.body)}`
        : `${node.kind === 'forall' ? '∀' : '∃'} ${vars} · ${print(node.body)}`;
    }
    case 'strongImplies':
      return `when ${print(node.left)} then ${print(node.right)}`;
    case 'implies':
      return node.surface === 'sugar'
        ? `if ${print(node.left)} then ${print(node.right)}`
        : `${print(node.left)} ⇒ ${print(node.right)}`;
    case 'iff':
      return node.surface === 'sugar'
        ? `${print(node.left)} iff ${print(node.right)}`
        : `${print(node.left)} ⇔ ${print(node.right)}`;
    case 'and':
      return node.surface === 'sugar'
        ? `${print(node.left)} and ${print(node.right)}`
        : `${print(node.left)} ∧ ${print(node.right)}`;
    case 'or':
      return node.surface === 'sugar'
        ? `${print(node.left)} or ${print(node.right)}`
        : `${print(node.left)} ∨ ${print(node.right)}`;
    case 'not':
      return node.surface === 'sugar'
        ? `not ${print(node.expr)}`
        : `¬ ${print(node.expr)}`;
    case 'until':
      return node.surface === 'sugar'
        ? `${print(node.left)} until${node.bound ? eventuallyBoundClause(node.bound) : ' '}${print(node.right)}`
        : `${print(node.left)} U${node.bound ? symbolicBoundText(node.bound) : ''} ${print(node.right)}`;
    case 'release':
      return node.surface === 'sugar'
        ? `${print(node.left)} release ${print(node.right)}`
        : `${print(node.left)} R ${print(node.right)}`;
    case 'weakUntil':
      return node.surface === 'sugar'
        ? `${print(node.left)}${node.bound ? globallyBoundClause(node.bound) : ' '}unless ${print(node.right)}`
        : `${print(node.left)} W${node.bound ? symbolicBoundText(node.bound) : ''} ${print(node.right)}`;
    case 'next':
      return node.surface === 'sugar'
        ? `next ${print(node.expr)}`
        : `○ ${print(node.expr)}`;
    case 'previous':
      return `● ${print(node.expr)}`;
    case 'eventually':
      return node.surface === 'sugar'
        ? `sooner-or-later${node.bound ? eventuallyBoundClause(node.bound) : ' '}${print(node.expr)}`
        : `◇${node.bound ? symbolicBoundText(node.bound) : ''} ${print(node.expr)}`;
    case 'once':
      return `♦ ${print(node.expr)}`;
    case 'always':
      return node.surface === 'sugar'
        ? `always${node.bound ? globallyBoundClause(node.bound) : ' '}${print(node.expr)}`
        : `□${node.bound ? symbolicBoundText(node.bound) : ''} ${print(node.expr)}`;
    case 'historically':
      return `■${node.bound ? symbolicBoundText(node.bound) : ''} ${print(node.expr)}`;
    case 'atLabel':
      return `${print(node.expr)}@${node.label}`;
    case 'paren':
      return `(${print(node.expr)})`;
    case 'comparison':
      return `${print(node.left)} ${node.operator} ${print(node.right)}`;
    case 'predicateCall':
      return `${node.name}(${node.args.join(', ')})`;
    case 'relationMembership':
      return `(${node.args.join(', ')}) in ${node.relation}`;
    case 'attributeAccess':
      return `${node.variable}.${node.attribute}`;
    case 'variableRef':
      return node.name;
    case 'literal':
      return typeof node.value === 'string'
        ? `"${node.value}"`
        : String(node.value);
  }
};

/** `print`, with internal whitespace normalized to single spaces (see the module doc). */
export const printLtl = (node: LtlNode): string =>
  print(node).replace(/\s+/g, ' ').trim();
