/**
 * The formulas SA-BSN's runtime loads (lesunb/bsn, goal-controller#93, #94):
 * `reliability.formula` and `cost.formula` in its knowledge repository, one
 * line each, no newline. `DataAccess::fetch_formula` serves the first line;
 * `ReliabilityEngine` and `CostEngine` compile it with Lepton and find the
 * components by its terms' prefixes (`CTX_`, `F_`, `R_`, `W_`), so the terms
 * are the contract.
 *
 * They are composed over the containers the PARAM formulas are: a leaf is
 * `CTX_x*F_x*R_x` (its context, when it has one; cc808b6's leaf, with its
 * frequency) and costs `CTX_x*W_x`; an AND-refined element, unannotated or
 * annotated `#` (PARAMProducer's parallel AND, 2019-12: the product of its
 * children's reliabilities, the sum of their costs), is its children's
 * product and sum in parentheses; an element with one child is that child.
 * Anything else has no runtime form in upstream's files yet.
 */
import type { RtTree } from '@goal-controller/goal-language';
import { GodaUnsupported, nodeIdOf, type Container } from './containers';
import type { GodaFormulas } from './formulas';

/** Whether an annotation is `#` over operands only (`[G3#G4]`, `[T1.1#…#T1.6]`). */
const parallelOnly = (tree: RtTree | null): boolean =>
  tree?.kind === 'ref' ||
  (tree?.kind === 'group' && parallelOnly(tree.expr)) ||
  (tree?.kind === 'binary' &&
    tree.operator === '#' &&
    parallelOnly(tree.left) &&
    parallelOnly(tree.right));

const unsupported = (what: string) => new GodaUnsupported(what, '#94');

/** reliability.formula and cost.formula of the selected root, as the BSN runtime reads them. */
export const composeRuntimeFormulas = (root: Container): GodaFormulas => {
  const compose = (node: Container): GodaFormulas => {
    const children = node.goals.length ? node.goals : node.plans;
    if (!children.length) {
      if (node.optional || node.cost)
        throw unsupported(
          `the runtime formula of ${nodeIdOf(node)} (optional, or with a cost)`,
        );
      const id = nodeIdOf(node);
      const ctx = node.fulfillmentConditions.length ? `CTX_${id}*` : '';
      return { reliability: `${ctx}F_${id}*R_${id}`, cost: `${ctx}W_${id}` };
    }
    const parts = children.map(compose);
    if (parts.length === 1) return parts[0]!;
    if (
      node.decomposition !== 'AND' ||
      (node.annotation && !parallelOnly(node.annotation))
    )
      throw unsupported(
        `the runtime formula of ${nodeIdOf(node)} (an OR, or an annotation other than #)`,
      );
    return {
      reliability: `(${parts.map((part) => part.reliability).join('*')})`,
      cost: `(${parts.map((part) => part.cost).join('+')})`,
    };
  };
  return compose(root);
};
