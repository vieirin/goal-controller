/**
 * The parametric reliability and cost formulas of the selected goal, as GODA's
 * PARAMProducer composes them at cc808b6 (`composeNodeForm`, `getNodeForm`,
 * `SymbolicParamAndGenerator`): by string substitution over the containers,
 * each node's formula written in its children's ids, then each id replaced
 * by its child's formula (goal-controller#34, D11). A leaf under a context is
 * multiplied by its `CTX_` parameter (`insertCtxAnnotation`).
 *
 * Upstream asks the PARAM tool for a leaf's reliability. A leaf's model is
 * fixed (it runs with `F`, else it is skipped, and succeeds with `R`), so its
 * reachability is `F_x*R_x` (`R_x` without the frequency): written here, no
 * tool is called. The clean-ups that follow (`replaceReliabilites`,
 * `cleanMultipleContexts`) are ported as they are, since they change what
 * the cost formula computes.
 */
import { clearElId, clearUid, nodeIdOf, type Container } from './containers';
import { clearCondition } from './contexts';
import { javaHashMapOrder } from './javaHashMap';

/** Java's `String.split(regex)`: trailing empty strings removed. */
const javaSplit = (text: string, separator: RegExp): string[] => {
  const parts = text.split(separator);
  while (parts.length && parts.at(-1) === '') parts.pop();
  return parts;
};

/** Java's `String.replaceAll(regex, replacement)`, the replacement taken literally. */
const replaceAll = (text: string, pattern: string, replacement: string) =>
  text.replace(new RegExp(pattern, 'g'), () => replacement);

/** `restricToString`: an id or a formula between spaces, as substitution finds them. */
const spaced = (text: string) => ` ${text} `;

/** The children's ids in a formula (`getChildrenId`): a goal's uid, a plan's element id. */
const childrenIds = (node: Container): string[] =>
  (node.goals.length ? node.goals : node.plans).map(nodeIdOf);

/** `SymbolicParamAndGenerator.getSequentialAndCost`. */
const sequentialAndCost = (nodes: readonly string[]): string => {
  const reliability = nodes.map((node) => ` R_${node} *`).join('');
  let formula = '(';
  for (const node of nodes) formula += `${reliability} ${node} +`;
  return `${formula.slice(0, -1)} )`;
};

/** `getNodeForm`'s OR (and, for an annotation, decision-making) formula. */
const orForm = (children: readonly string[], reliability: boolean): string => {
  const [a, b] = children as [string, string];
  let formula = `( - ${a} * ${b} + ${a} + ${b} ) `;
  let remove = '';
  let sumCost = '';
  if (!reliability) {
    formula = replaceAll(formula, a, `R_${a}`);
    formula = replaceAll(formula, b, `R_${b}`);
    remove = ` - R_${a} * ${b}`;
    sumCost = `${a} + ${b}`;
  }
  for (const child of children.slice(2)) {
    if (!reliability) {
      remove += ` - ${formula} * ${child}`;
      sumCost += ` + ${child}`;
    }
    formula = `( - ${formula} * ${child} + ${formula} + ${child} ) `;
    if (!reliability) formula = replaceAll(formula, child, `R_${child}`);
  }
  return reliability ? formula : ` ( ${formula} * ( ${sumCost} ) ${remove} ) `;
};

/**
 * `getNodeForm`: a node's formula in its children's ids (its own id when it
 * has one child or none). An element with an RT annotation (a DM) is read as
 * an OR over its children, whatever the annotation says; its one child, as
 * that child (in the cost, times its reliability).
 */
const nodeForm = (node: Container, reliability: boolean): string => {
  const children = childrenIds(node);
  if (node.annotation) {
    const [only] = children;
    if (children.length === 1)
      return reliability ? ` ( ${only} )` : ` ( R_${only} * ${only} )`;
    return orForm(children, reliability);
  }
  if (children.length <= 1) return nodeIdOf(node);
  if (node.decomposition === 'AND')
    return reliability
      ? `( ${children
          .map((id) => `${id} * `)
          .join('')
          .slice(0, -2)} )`
      : sequentialAndCost(children);
  return orForm(children, reliability);
};

/** `replaceSubForm`: a child's formula in place of its id. */
const replaceSubForm = (
  form: string,
  subForm: string,
  id: string,
  subId: string,
): string =>
  form === id ? subForm : replaceAll(form, spaced(subId), spaced(subForm));

export type GodaFormulas = { reliability: string; cost: string };

/** reliability.out and cost.out (with the trailing newline Java's `println` adds). */
export const composeFormulas = (
  root: Container,
  { frequency }: { frequency: boolean },
): GodaFormulas => {
  const reliabilityComments: string[] = [];
  const costComments: string[] = [];
  const reliabilityByNode = new Map<string, string>();
  // ctxInformation: each context parameter and its conditions, as written
  const ctxInformation = new Map<string, string>();

  /**
   * PARAMProducer's `getContextId`: the child of the nearest decision-making
   * element on the way up (the one whose context its module sets), else the
   * node itself.
   */
  const contextIdOf = (node: Container): string => {
    let child = node;
    for (let root = node.root; root; root = root.root) {
      if (root.decisionMaking.length) return nodeIdOf(child);
      child = root;
    }
    return nodeIdOf(node);
  };

  const compose = (node: Container, reliability: boolean): string => {
    const id = nodeIdOf(node);
    let form = nodeForm(node, reliability);
    for (const goal of node.goals)
      form = replaceSubForm(
        form,
        compose(goal, reliability),
        id,
        clearUid(goal),
      );
    for (const plan of node.plans)
      form = replaceSubForm(
        form,
        compose(plan, reliability),
        id,
        clearElId(plan),
      );
    if (!node.goals.length && !node.plans.length) {
      if (reliability) {
        form = frequency ? `F_${id}*R_${id}` : `R_${id}`;
        reliabilityComments.push(`//R_${id} = reliability of node ${id}\n`);
        if (frequency)
          reliabilityComments.push(`//F_${id} = frequency of node ${id}\n`);
      } else {
        // `getCostFormula`: a leaf's cost, or its weight W_
        form = node.cost
          ? node.cost.variable === null
            ? node.cost.value!
            : `${node.cost.value ?? '1'}*${node.cost.variable}`
          : `W_${id}`;
        costComments.push(`//${form} = cost of node ${id}\n`);
      }
      // insertCtxAnnotation: times its context's parameter
      if (node.fulfillmentConditions.length) {
        const parameter = `CTX_${contextIdOf(node)}`;
        form = `${parameter}*${form}`;
        ctxInformation.set(
          parameter,
          node.fulfillmentConditions
            .map((condition) => `(${clearCondition(condition)})`)
            .join(' & '),
        );
      }
    }
    if (reliability) reliabilityByNode.set(id, form);
    return form;
  };

  const reliability = compose(root, true).replace(/\s+/g, '');
  let cost = compose(root, false);
  // replaceReliabilites: a child's reliability in place of its R_ in the cost
  if (cost.includes(' R_'))
    for (const [id, form] of reliabilityByNode)
      cost = replaceAll(cost, ` R_${id} `, ` ${form} `);
  cost = cleanMultipleContexts(cost).replace(/\s+/g, '');

  // composeFormula: the contexts first, in their HashMap's order
  const contexts = javaHashMapOrder([...ctxInformation.keys()])
    .map((key) => `//${key} = ${ctxInformation.get(key)}\n`)
    .join('');
  const write = (form: string, comments: readonly string[]) =>
    `${form}\n\n${contexts}${comments.join('')}\n`;
  return {
    reliability: write(reliability, reliabilityComments),
    cost: write(cost, [...reliabilityComments, ...costComments]),
  };
};

/**
 * `cleanMultipleContexts`: in each product of the cost formula, a factor
 * written twice is written once (and a factor `1` dropped).
 */
const cleanMultipleContexts = (form: string): string => {
  let result = form;
  for (const sum of javaSplit(form, /\+/))
    for (const term of javaSplit(sum, /-/)) {
      const bare = term
        .replace(/\(/g, '')
        .replace(/\)/g, '')
        .replace(/\s+/g, '');
      if (bare !== '1' && bare !== '')
        result = replaceCtxRepetition(result, javaSplit(term, /\*/));
    }
  return result;
};

const replaceCtxRepetition = (form: string, factors: string[]): string => {
  const lump = new Set<string>();
  let without = '';
  let withRepetition = '';
  for (let factor of factors) {
    if (factor.startsWith(' (')) factor = factor.slice(1);
    factor = factor.replace(/\(/g, '').replace(/\)/g, '');
    withRepetition = withRepetition ? `${withRepetition}\\*${factor}` : factor;
    factor = factor.replace(/\s+/g, '');
    if (!lump.has(factor)) {
      lump.add(factor);
      if (factor !== '1') without = without ? `${without}*${factor}` : factor;
    }
  }
  return replaceAll(form, withRepetition, without);
};
