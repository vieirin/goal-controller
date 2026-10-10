/**
 * The PRISM MDP of one actor and its `eval_formula.sh`, as GODA's PrismWriter
 * writes them at cc808b6 (`generator/goda/writer/PrismWriter.java`): one
 * module per leaf task, sequenced by its time slots; a formula per goal; the
 * `success` label on each root; a `cost` reward per leaf.
 */
import {
  clearElId,
  clearElName,
  GodaUnsupported,
  type Container,
} from './containers';
import type { GodaGenerator } from './variants';

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

/** The model and its evaluation script (with the trailing newline Java's `println` adds), of sorted roots. */
export const writePrism = (
  roots: readonly Container[],
  { templates, guards }: Pick<GodaGenerator, 'templates' | 'guards'>,
): { model: string; evalScript: string } => {
  let planModules = '';
  let rewardModule = '';
  const rewardVariables: string[] = [];
  let evalParams = '';
  let evalReplace = '';

  const param = (name: string, value: string) => {
    evalParams += `${name}="${value}";\n`;
    evalReplace += ` -e "s/${name}/$${name}/g"`;
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
    rewardModule += replace(
      replace(templates.rewardEntry, '$GID$', id),
      '$COST$',
      cost,
    );
  };

  const writeModule = (plan: Container): [string, string] => {
    if (plan.fulfillmentConditions.length)
      throw new GodaUnsupported(
        'a context condition (creationProperty)',
        '#36, #38',
      );
    const id = clearElId(plan);
    let module = replace(
      templates.leafGoal,
      '$MODULE_NAME$',
      clearElName(plan),
    );
    module = replace(module, '$DEC_HEADER$', '');
    module = replace(module, '$DEC_TYPE$', templates.and);
    for (const [tag, guard] of Object.entries(guards(plan)))
      module = replace(module, tag, guard);
    param(`W_${id}`, '1');
    param(`R_${id}`, '0.99');
    if (templates.frequency) param(`F_${id}`, '0.99');
    module = replace(module, '$PREV_TIME_SLOT$', `_${plan.timeSlot - 1}`);
    module = replace(module, '$TIME_SLOT$', `_${plan.timeSlot}`);
    module = replace(module, '$GID$', id);
    module = replace(module, '$CONST_PARAM$', 'const');
    planModules += `${module}\n`;
    return [id, `s${id}=2`];
  };

  /** Without its last operator (`StringBuilder.replace(lastIndexOf(op), length, "")`). */
  const dropLast = (text: string, operator: string) => {
    const at = text.lastIndexOf(operator);
    return at < 0 ? text : text.slice(0, at);
  };

  const writeElement = (root: Container): [string, string] => {
    const id = clearElId(root);
    const operator = root.decomposition === 'AND' ? ' & ' : ' | ';
    if (root.goals.length) {
      let formula = '';
      let previous: string | null = null;
      for (const goal of root.goals) {
        writeElement(goal);
        if (goal.included) previous = clearElId(goal);
        if (previous !== null) formula += previous + operator;
      }
      if (previous !== null) formula = dropLast(formula, operator);
      if (root.included) planModules += `formula ${id} = ${formula};\n`;
      return [id, formula];
    }
    if (root.plans.length) {
      let formula = '';
      for (const plan of root.plans) {
        const [, child] = writeElement(plan);
        if (child) formula += `(${child})${operator}`;
      }
      if (formula) formula = dropLast(formula, operator);
      if (root.kind === 'goal')
        planModules += `formula ${id} = ${formula};\n\n`;
      return [id, formula];
    }
    if (root.kind === 'plan') {
      writeReward(root);
      return writeModule(root);
    }
    return ['', ''];
  };

  for (const root of roots) {
    writeElement(root);
    planModules += `label "success" = ${clearElId(root)};`;
  }

  const body = replace(templates.body, '$GOAL_MODULES$', planModules);
  const declared = rewardVariables.map((v) => `\nconst double ${v};`).join('');
  const reward = `${declared}\n${replace(templates.reward, '$REWARD_STRUCTURE$', rewardModule)}`;
  const evalScript = replace(
    replace(templates.evalFormula, '$PARAMS_BASH$', evalParams),
    '$REPLACE_BASH$',
    evalReplace,
  );
  return {
    model: `${templates.header}\n${body}${reward}\n`,
    evalScript: `${evalScript}\n`,
  };
};
