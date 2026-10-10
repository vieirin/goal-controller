/**
 * The parametric formulas and their evaluation script as GODA's
 * PARAMProducer writes them at 5305bc1 (2019-07): a leaf's reliability is
 * `R_x` (no frequency); a parent multiplies each child that has a context by
 * its `CTX_<child>` (`setContextList`, `getNodeForm`); the eval script lists
 * the formulas' own parameters (`composeEvalFormula`). Upstream keeps the
 * contexts, the leaves' comments and every node's reliability in HashMaps,
 * and the order they come out in (comments, the eval script, the cost's
 * substitutions) is theirs: `javaHashMapOrder`.
 */
import { clearElId, clearUid, nodeIdOf, type Container } from './containers';
import { clearCondition } from './contexts';
import { javaHashMapOrder } from './javaHashMap';
import type { GodaFormulas } from './formulas';

/** Java's `Pattern.compile(find).matcher(sb).replaceAll(replace)`, the replacement taken literally. */
const replaceAll = (text: string, find: string, replacement: string) =>
  text.replace(new RegExp(find, 'g'), () => replacement);

/** The children's ids in a formula (`getChildrenId`): a goal's uid, a plan's element id. */
const childrenIds = (node: Container): string[] =>
  (node.goals.length ? node.goals : node.plans).map(nodeIdOf);

/** A HashMap that remembers the order its keys first went in. */
class JavaMap {
  private readonly entries = new Map<string, string>();
  constructor(entries: Iterable<[string, string]> = []) {
    for (const [key, value] of entries) this.entries.set(key, value);
  }
  set(key: string, value: string) {
    this.entries.set(key, value);
  }
  has(key: string) {
    return this.entries.has(key);
  }
  get(key: string) {
    return this.entries.get(key);
  }
  /** its entries in the order Java iterates them */
  ordered(): [string, string][] {
    return javaHashMapOrder([...this.entries.keys()]).map((key) => [
      key,
      this.entries.get(key)!,
    ]);
  }
}

export const composeFormulas5305bc1 = (
  root: Container,
  evalTemplate: string,
): GodaFormulas & { evalScript: string } => {
  let ctxInformation = new JavaMap();
  const varReliability = new JavaMap();
  const varCost = new JavaMap();
  const reliabilityByNode = new JavaMap();
  const hasCtx = (id: string) => ctxInformation.has(id);

  /** `setContextList`: the contexts of a node's children, by their ids. */
  const setContextList = (node: Container) => {
    const children = node.goals.length ? node.goals : node.plans;
    for (const child of children)
      if (child.fulfillmentConditions.length)
        ctxInformation.set(
          child.kind === 'goal' ? clearUid(child) : clearElId(child),
          child.fulfillmentConditions
            .map((condition) => `(${clearCondition(condition)})`)
            .join(' & '),
        );
  };

  /** A child as a factor: times its context when it has one. */
  const factor = (id: string) => (hasCtx(id) ? `CTX_${id} * ${id}` : id);

  /** `getNodeForm`'s OR, and its decision-making form (every child with a context). */
  const orForm = (
    children: readonly string[],
    reliability: boolean,
    decision: boolean,
  ): string => {
    const [a, b] = children as [string, string];
    let formula = decision
      ? `( - CTX_${a} * ${a} * CTX_${b} * ${b} + CTX_${a} * ${a} + CTX_${b} * ${b} ) `
      : `( - ${factor(a)} * ${factor(b)} + ${factor(a)} + ${factor(b)} ) `;
    let remove = '';
    let sumCost = '';
    if (!reliability) {
      formula = replaceAll(formula, ` ${a} `, ` R_${a} `);
      formula = replaceAll(formula, ` ${b} `, ` R_${b} `);
      if (decision) {
        remove = ` - CTX_${a} * R_${a} * CTX_${b} * ${b}`;
        sumCost = ` CTX_${a} * ${a} + CTX_${b} * ${b}`;
      } else {
        remove = ` - ${hasCtx(a) ? `CTX_${a} * ` : ''}R_${a} * ${factor(b)}`;
        sumCost = `${factor(a)} + ${factor(b)}`;
      }
    }
    for (const child of children.slice(2)) {
      if (decision && !hasCtx(child))
        throw new Error(
          `GODA: ${child} is a decision-making operand without a context`,
        );
      if (!reliability) {
        // upstream adds a decision's later children to the cost without their context
        remove += ` - ${formula} * ${decision || hasCtx(child) ? `CTX_${child} * ` : ''}${child}`;
        sumCost += decision ? ` + ${child}` : ` + ${factor(child)}`;
      }
      const current = formula;
      // `insert(0, "( - ")` and an append that writes the formula again (an OR's twice: upstream's)
      formula = decision
        ? `( - ${current} * CTX_${child} * ${child} + ${current} + CTX_${child} * ${child} ) `
        : `( - ${current}${current} * ${factor(child)} + ${current} + ${factor(child)} ) `;
      if (!reliability)
        formula = replaceAll(formula, ` ${child} `, `R_${child}`);
    }
    return reliability ? formula : ` ( ( ${sumCost} ) * ${formula} ${remove} )`;
  };

  const nodeForm = (node: Container, reliability: boolean): string => {
    const children = childrenIds(node);
    const id = nodeIdOf(node);
    if (node.annotation) {
      // a decision: every child is chosen by its context
      if (children.length === 1) {
        const [only] = children as [string];
        if (!hasCtx(only))
          throw new Error(
            `GODA: ${only} is a decision-making operand without a context`,
          );
        return reliability
          ? ` ( CTX_${only} * ${only} )`
          : ` ( CTX_${only} * R_${only} * ${only} )`;
      }
      if (!hasCtx(children[0]!) && !hasCtx(children[1]!))
        throw new Error(
          `GODA: ${children[0]} and ${children[1]} are decision-making operands without a context`,
        );
      return orForm(children, reliability, true);
    }
    if (children.length <= 1) return id;
    if (node.decomposition === 'AND') {
      if (reliability)
        // `( a * CTX_b * b )`: upstream deletes the last `*`, keeping the space after it
        return `( ${children
          .map((child) =>
            hasCtx(child) ? ` CTX_${child} * ${child} * ` : `${child} * `,
          )
          .join('')
          .replace(/\*([^*]*)$/, '$1')})`;
      // SymbolicParamAndGenerator.getSequentialAndCost, times the node's reliability
      const sum = children
        .map((child) =>
          hasCtx(child) ? ` CTX_${child} * ${child} +` : ` ${child} +`,
        )
        .join('');
      return `(${sum.slice(0, -1)} ) * R_${id} `;
    }
    return orForm(children, reliability, false);
  };

  /** `replaceSubForm`: a child's formula in place of its id. */
  const replaceSubForm = (
    form: string,
    subForm: string,
    id: string,
    subId: string,
  ): string =>
    form === id ? subForm : replaceAll(form, ` ${subId} `, ` ${subForm} `);

  const compose = (node: Container, reliability: boolean): string => {
    const id = nodeIdOf(node);
    if (node.goals.length || node.plans.length) setContextList(node);
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
        form = `R_${id}`;
        varReliability.set(id, `//R_${id} = reliability of node ${id}\n`);
        if (node.optional) {
          form += `*OPT_${id}`;
          // the same key: an optional leaf's R_ line is replaced (BSN's eval script lacks it)
          varReliability.set(id, `//OPT_${id} = optionality of node ${id}\n`);
        }
      } else {
        form = node.cost
          ? node.cost.variable === null
            ? node.cost.value!
            : `${node.cost.value ?? '1'}*${node.cost.variable}`
          : `W_${id}`;
        varCost.set(id, `//${form} = cost of node ${id}\n`);
      }
    }
    if (reliability) reliabilityByNode.set(id, form);
    return form;
  };

  /** `cleanNodeForm`: the contexts the formula names, kept (a new HashMap), and no whitespace. */
  const clean = (form: string, reliability: boolean): string => {
    let cleaned = form;
    if (!reliability && cleaned.includes(' R_'))
      // replaceReliabilites: each node's reliability in place of its R_, in the HashMap's order
      for (const [id, nodeReliability] of reliabilityByNode.ordered())
        if (cleaned.includes(`R_${id}`))
          cleaned = replaceAll(cleaned, ` R_${id} `, ` ${nodeReliability} `);
    ctxInformation = new JavaMap(
      ctxInformation
        .ordered()
        .filter(([key]) => cleaned.includes(`CTX_${key}`)),
    );
    return cleaned.replace(/\s+/g, '');
  };

  // run(): both composed, then both cleaned (the cost's composition sees every context)
  const composedReliability = compose(root, true);
  const composedCost = compose(root, false);
  const reliability = clean(composedReliability, true);
  const cost = clean(composedCost, false);

  const contexts = ctxInformation
    .ordered()
    .map(([key, value]) => `//CTX_${key} = ${value}\n`)
    .join('');
  const reliabilities = varReliability
    .ordered()
    .map(([, line]) => line)
    .join('');
  const costs = varCost
    .ordered()
    .map(([, line]) => line)
    .join('');

  // composeEvalFormula: the contexts, each leaf's R_ or OPT_, each leaf's W_
  let params = '';
  let replaces = '';
  const param = (name: string, value: string) => {
    params += `${name}="${value}";\n`;
    replaces += ` -e "s/${name}/$${name}/g"`;
  };
  for (const [key] of ctxInformation.ordered()) param(`CTX_${key}`, '1');
  for (const [id, line] of varReliability.ordered())
    if (line.includes('OPT_')) param(`OPT_${id}`, '1');
    else param(`R_${id}`, '0.99');
  for (const [id] of varCost.ordered()) param(`W_${id}`, '1');

  // println: one newline more
  return {
    reliability: `${reliability}\n\n${contexts}${reliabilities}\n`,
    cost: `${cost}\n\n${contexts}${reliabilities}${costs}\n`,
    evalScript: `${evalTemplate.replace('$PARAMS_BASH$', () => params).replace('$REPLACE_BASH$', () => replaces)}\n`,
  };
};
