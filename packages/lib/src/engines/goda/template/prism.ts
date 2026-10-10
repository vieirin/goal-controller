/**
 * The PRISM MDP of one actor and its `eval_formula.sh`, as GODA's PrismWriter
 * writes them at cc808b6 (`generator/goda/writer/PrismWriter.java`): one
 * module per leaf task, sequenced by its time slots; a decision-making module
 * before an element with a DM annotation, choosing its children's contexts;
 * a formula per goal; the `success` label on each root; a `cost` reward per
 * leaf.
 */
import { clearElId, clearElName, type Container } from './containers';
import { contextsInfo } from './contexts';
import type { GodaGenerator } from './variants';

/** Where an element's text starts in the output (null: where no element's does). */
type Owned = { from: number; owner: string | null };

/**
 * Each line's owner: the element whose text the line ends in (the text from
 * one element's start to the next's is that element's; a reward entry starts
 * after its line's tab); a blank line and a line outside them belong to none.
 */
const linesOwned = (text: string, owned: readonly Owned[]): string[][] => {
  const starts = [...owned].sort((a, b) => a.from - b.from);
  let at = -1;
  let from = 0;
  return text.split('\n').map((line) => {
    const last = from + Math.max(line.trimEnd().length - 1, 0);
    while (at + 1 < starts.length && starts[at + 1]!.from <= last) at++;
    const owner = at >= 0 ? starts[at]!.owner : null;
    from += line.length + 1;
    return owner && line.trim() ? [owner] : [];
  });
};

/** Java's `String.replace`: every occurrence, literally. */
const replace = (text: string, target: string, value: string): string =>
  text.split(target).join(value);

/** `CostParser`: a leaf's cost as a constant and an optional variable (`W = x` is `1*x`). */
const costOf = (
  cost: NonNullable<Container['cost']>,
): { value: string; variable: string | null } => ({
  value: cost.value ?? '1',
  variable: cost.variable,
});

/**
 * The root goals in the order the writer sorts them (`Collections.sort`, by
 * previous time path, time slot, then id); the formulas are the first's.
 */
export const sortRoots = (roots: readonly Container[]): Container[] =>
  [...roots].sort(
    (a, b) =>
      a.prevTimePath - b.prevTimePath ||
      a.timeSlot - b.timeSlot ||
      (a.elId < b.elId ? -1 : a.elId > b.elId ? 1 : 0),
  );

/**
 * `GenerateCombination(items, 0)`: every non-empty combination, in the order
 * of a binary count over the items (the first item is the lowest bit).
 */
export const combinations = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: 2 ** items.length - 1 }, (_, i) =>
    items.filter((_, bit) => ((i + 1) >> bit) & 1),
  );

/** Java's `String.compareTo` (UTF-16 code units), a `TreeMap<String, …>`'s order. */
const byCodeUnits = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** The model and its evaluation script (with the trailing newline Java's `println` adds), of sorted roots. */
export const writePrism = (
  roots: readonly Container[],
  {
    templates,
    guards,
    slots,
    leafContext,
  }: Pick<GodaGenerator, 'templates' | 'guards' | 'slots' | 'leafContext'>,
): {
  model: string;
  /** for each line of the model, the piStar ids of the elements it belongs to */
  owners: string[][];
  evalScript: string;
} => {
  let planModules = '';
  let rewardModule = '';
  // where each element's text is, in planModules and rewardModule
  const moduleOwners: Owned[] = [];
  const rewardOwners: Owned[] = [];
  const emit = (text: string, owner: Container) => {
    moduleOwners.push({ from: planModules.length, owner: owner.iStarId });
    planModules += text;
  };
  const rewardVariables: string[] = [];
  let evalParams = '';
  let evalReplace = '';
  let evalContexts = '';
  // each decision-making module's children and their contexts (`nonDeterminismCtxList`)
  const nonDeterminismCtxList = new Map<Container, string>();
  // the next combination's constant, CTX_<n>, across the model's modules
  let nonDeterminismCtxId = 1;
  const [rootGoal] = roots;

  const param = (
    name: string,
    value: string,
    // upstream writes an optionality's replacement without its first `/`
    substitute = `s/${name}/$${name}/g`,
  ) => {
    evalParams += `${name}="${value}";\n`;
    evalReplace += ` -e "${substitute}"`;
  };

  const writeReward = (plan: Container) => {
    const id = clearElId(plan);
    let cost: string;
    if (plan.cost) {
      const { value, variable } = costOf(plan.cost);
      cost = variable === null ? value : `${value}*${variable}`;
      if (variable !== null && !rewardVariables.includes(variable))
        rewardVariables.push(variable);
    } else {
      cost = `W_${id}`;
      if (!rewardVariables.includes(cost)) rewardVariables.push(cost);
    }
    rewardOwners.push({ from: rewardModule.length, owner: plan.iStarId });
    rewardModule += replace(
      replace(templates.rewardEntry, '$GID$', id),
      '$COST$',
      cost,
    );
  };

  /** `equalsRoot`: whether `plan` descends from `alt` (up to the first root goal). */
  const equalsRoot = (alt: Container, plan: Container): boolean => {
    let root = plan.root;
    while (root && root !== rootGoal) {
      if (alt === root) return true;
      root = root.root;
    }
    return alt === root;
  };
  /** `getKeyRTContainer`: the first decision-making child with these contexts. */
  const ndChildWith = (ctx: string): Container | undefined =>
    [...nonDeterminismCtxList].find(([, value]) => value === ctx)?.[0];

  /**
   * `writeNondeterministicModule`: the module that picks, once, one
   * combination of a decision-making element's children's contexts (each a
   * `CTX_<n>` constant) and sets each chosen child's `CTX_<child>` global.
   */
  const writeNondeterministicModule = (root: Container) => {
    const children = root.goals.length ? root.goals : root.plans;
    // getContextList: a TreeMap, by the children's ids
    const contexts = new Map<string, string>();
    for (const child of children) {
      const info = contextsInfo(child.fulfillmentConditions);
      nonDeterminismCtxList.set(child, info);
      contexts.set(clearElId(child), info);
    }
    const ids = [...contexts.keys()].sort(byCodeUnits);
    let header = '';
    let type = '';
    let globals = '\n';
    let finalType = '';
    let nextState = 1;
    for (const combination of combinations(ids)) {
      header += `${replace(templates.ndHeader, '$N$', String(nonDeterminismCtxId))} //`;
      let contextUpdate = '';
      for (const id of ids) {
        const global = `global CTX_${id}: [0..1] init 0;\n`;
        if (!globals.includes(global)) globals += global;
        if (combination.includes(id)) {
          header += ` ${contexts.get(id)} &`;
          contextUpdate += ` & (CTX_${id}'=1)`;
        }
      }
      // the last character (the `&`) becomes the line's end
      header = `${header.slice(0, -1)}\n`;
      let body = replace(templates.ndBody, '$N$', String(nonDeterminismCtxId));
      body = replace(body, '$NEXT_STATE$', String(nextState + 1));
      // 5305bc1's choice sets the globals itself (cc808b6's in $FINAL_TYPE$)
      body = replace(body, '$CONTEXT_UPDATE$', contextUpdate);
      finalType += `\t[] s$GID$ = ${nextState + 1} -> (s$GID$'=$MAX_ND$)${contextUpdate};\n`;
      type += type ? `\t${body}` : body;
      nonDeterminismCtxId += 1;
      nextState += 1;
    }
    header += globals;
    const maxNd = String(nextState + 1);
    let module = replace(templates.nondeterminism, '$MAX_ND$', maxNd);
    module = replace(
      module,
      '$FINAL_TYPE$',
      replace(finalType, '$MAX_ND$', maxNd),
    );
    module = replace(module, '$DEC_HEADER$', header);
    module = replace(module, '$DEC_TYPE$', type);
    module = replace(module, '$GID$', clearElId(root));
    const { prev, time } = slots(root);
    module = replace(module, '$PREV_TIME_SLOT$', `_${prev}`);
    module = replace(module, '$TIME_SLOT$', `_${time}`);
    emit(`${module}\n`, root);
  };

  const writeModule = (
    plan: Container,
    prevFormula: string | null,
  ): [string, string] => {
    const id = clearElId(plan);
    const contextPresent = plan.fulfillmentConditions.length > 0;
    let header = '';
    let type = '';
    // an optional leaf starts or is skipped by its optionality, times its own
    // context when it has one (`$IF_CTX$`)
    if (plan.optional) {
      header += templates.optHeader;
      type += replace(
        templates.opt,
        '$IF_CTX$',
        contextPresent ? '*CTX_$GID$' : '',
      );
      // upstream writes this substitution without its first `/`
      param(`OPT_${id}`, '1', `sOPT_${id}/$OPT_${id}/g`);
    }
    if (contextPresent) {
      const ctx = contextsInfo(plan.fulfillmentConditions);
      // a context a decision-making module sets is its global, under that child's id
      const { ctxId, nonDeterminismCtx } = leafContext(plan, ctx, {
        list: nonDeterminismCtxList,
        equalsRoot,
        childWith: ndChildWith,
      });
      if (!evalContexts.includes(`CTX_${ctxId}="1";\n`)) {
        evalContexts += `CTX_${ctxId}="1";\n`;
        param(`CTX_${ctxId}`, '1');
      }
      if (!plan.optional)
        type += replace(templates.ctxSkip, '$CTX_GID$', `CTX_${ctxId}`);
      // getContextHeader: its constant, commented with its contexts
      if (!nonDeterminismCtx)
        header += `${templates.ctxHeader.slice(0, -2)} //${ctx}\n`;
    } else if (!plan.optional) type += templates.and;
    let module = replace(
      templates.leafGoal,
      '$MODULE_NAME$',
      clearElName(plan),
    );
    module = replace(module, '$DEC_HEADER$', header);
    module = replace(module, '$DEC_TYPE$', type);
    for (const [tag, guard] of Object.entries(guards(plan, prevFormula)))
      module = replace(module, tag, guard);
    param(`W_${id}`, '1');
    param(`R_${id}`, '0.99');
    if (templates.frequency) param(`F_${id}`, '0.99');
    const { prev, time } = slots(plan);
    module = replace(module, '$PREV_TIME_SLOT$', `_${prev}`);
    module = replace(module, '$TIME_SLOT$', `_${time}`);
    module = replace(module, '$GID$', id);
    module = replace(module, '$CONST_PARAM$', 'const');
    emit(`${module}\n`, plan);
    // an optional leaf succeeds, or is skipped
    return [id, plan.optional ? `s${id}=2 | s${id}=3` : `s${id}=2`];
  };

  /** Without its last operator (`StringBuilder.replace(lastIndexOf(op), length, "")`). */
  const dropLast = (text: string, operator: string) => {
    const at = text.lastIndexOf(operator);
    return at < 0 ? text : text.slice(0, at);
  };

  /**
   * `writeElement`: an element's modules, and its success formula. A goal's
   * goals are written in order, each after the formula of the one before it
   * when it starts in a later slot (`prevFormula`: the 2019-07 guards read
   * it); a task's tasks after the formula its parent was given.
   */
  const writeElement = (
    root: Container,
    prevFormula: string | null,
  ): [string, string] => {
    if (root.decisionMaking.length) writeNondeterministicModule(root);
    const id = clearElId(root);
    const operator = root.decomposition === 'AND' ? ' & ' : ' | ';
    if (root.goals.length) {
      let formula = '';
      let previous = prevFormula;
      const firstSlot = root.goals[0]!.rootTimeSlot;
      for (const goal of root.goals) {
        writeElement(
          goal,
          firstSlot < goal.rootTimeSlot ? previous : prevFormula,
        );
        if (goal.included) previous = clearElId(goal);
        if (previous !== null) formula += previous + operator;
      }
      if (previous !== null) formula = dropLast(formula, operator);
      if (root.included) emit(`formula ${id} = ${formula};\n`, root);
      return [id, formula];
    }
    if (root.plans.length) {
      let formula = '';
      for (const plan of root.plans) {
        const [, child] = writeElement(plan, prevFormula);
        if (child) formula += `(${child})${operator}`;
      }
      if (formula) formula = dropLast(formula, operator);
      if (root.kind === 'goal') emit(`formula ${id} = ${formula};\n\n`, root);
      return [id, formula];
    }
    if (root.kind === 'plan') {
      writeReward(root);
      return writeModule(root, prevFormula);
    }
    return ['', ''];
  };

  for (const root of roots) {
    writeElement(root, null);
    emit(`label "success" = ${clearElId(root)};`, root);
  }

  const body = replace(templates.body, '$GOAL_MODULES$', planModules);
  const declared = rewardVariables.map((v) => `\nconst double ${v};`).join('');
  const reward = `${declared}\n${replace(templates.reward, '$REWARD_STRUCTURE$', rewardModule)}`;
  const evalScript = replace(
    replace(templates.evalFormula, '$PARAMS_BASH$', evalParams),
    '$REPLACE_BASH$',
    evalReplace,
  );
  const model = `${templates.header}\n${body}${reward}\n`;
  const modulesAt =
    templates.header.length + 1 + templates.body.indexOf('$GOAL_MODULES$');
  const rewardsAt =
    templates.header.length +
    1 +
    body.length +
    declared.length +
    1 +
    templates.reward.indexOf('$REWARD_STRUCTURE$');
  return {
    model,
    owners: linesOwned(model, [
      ...moduleOwners.map(({ from, owner }) => ({
        from: modulesAt + from,
        owner,
      })),
      // what follows the modules (the reward variables) is no element's
      { from: modulesAt + planModules.length, owner: null },
      ...rewardOwners.map(({ from, owner }) => ({
        from: rewardsAt + from,
        owner,
      })),
      { from: rewardsAt + rewardModule.length, owner: null },
    ]),
    evalScript: `${evalScript}\n`,
  };
};
