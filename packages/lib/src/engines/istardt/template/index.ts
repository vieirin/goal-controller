/**
 * The DT-Golog writer (goal-controller#119): a model in the iStar-DT
 * dialect as the Prolog file `dtx2dtg`'s `com2dtg` writes (cmg-york/istardt
 * at `649c9be`), section by section and string by string, so it is byte for
 * byte the translator's after the four header lines (#117 D1.1).
 *
 * What the translator leaves as a TODO is written as ER 2024 §3.2 and the
 * BNF say, and marked unverified in `istardt.md`: a task's own `pre`, `npr`,
 * `turnsFalse`, `set` and variables, and a quality given by utility links.
 */
import { readAssertion, readExpression } from '@goal-controller/goal-language';
import type { AnalysisModel } from '../../analysis';
import { singleFileOutput, type EngineOutput } from '../../output';
import {
  pairItems,
  readIstardtModel,
  type IstardtElement,
  type IstardtModel,
  type IstardtProblem,
} from '../model';
import { istardtProblems } from '../checks';
import { camelCase, javaFloat } from '../vocabulary';
import {
  conditionText,
  FormulaError,
  qualityLookups,
  qualityValue,
  readsPreviousOf,
  termOf,
  type Resolve,
} from './formulas';

export { FormulaError } from './formulas';

/** The writer's problems: what it can't write, said once each. */
export class IstardtWriteError extends Error {
  constructor(readonly problems: readonly IstardtProblem[]) {
    super(problems.map((p) => p.message).join('\n'));
  }
}

export type IstardtWriteOptions = {
  /** the name the header gives the model (dtx2dtg's test harness: `Spec`) */
  modelName: string;
  /** the header's date (dtx2dtg's test harness: `TEST`) */
  date?: string;
  /**
   * the observations' type (the file's `continuous` option): dtx2dtg
   * writes `continuous` whatever the option says; off writes `discrete`,
   * as its commented-out line would
   */
  continuous?: boolean;
};

/** Drops a string's last character, as `substring(0, length() - 1)`. */
const chop = (text: string, n = 1) => text.slice(0, text.length - n);

/** `PermutationsGenerator`: every order of the children, by swaps, joined with ` : `. */
const permutations = (input: string[]): string[] => {
  const result: string[] = [];
  const list = [...input];
  const permute = (start: number) => {
    if (start === list.length - 1) {
      result.push(list.join(' : '));
      return;
    }
    for (let i = start; i < list.length; i++) {
      [list[start], list[i]] = [list[i]!, list[start]!];
      permute(start + 1);
      [list[start], list[i]] = [list[i]!, list[start]!];
    }
  };
  permute(0);
  return result;
};

const fluent = (name: string) => `${name}_fl`;
const sat = (name: string) => `${name}_Sat`;
const att = (name: string) => `${name}_Att`;

const isTrue = (value: string | undefined) => value?.trim() === 'true';

/** The model as DT-Golog: the file's text, or the problems that stop it. */
export const istardtTemplate = (
  model: IstardtModel,
  { modelName, date = 'TEST', continuous = true }: IstardtWriteOptions,
): string => {
  // the model as a whole first: the writer stops on its errors
  const errors = istardtProblems(model).filter((p) => p.severity === 'error');
  if (errors.length) throw new IstardtWriteError(errors);
  const problems: IstardtProblem[] = [];
  const fail = (element: IstardtElement | undefined, message: string) =>
    problems.push({
      severity: 'error',
      message,
      ...(element && { element: element.pistarId }),
    });
  const resolve: Resolve = (name) =>
    model.byIdentifier.get(name) ??
    model.elements.find((element) => element.id === name);
  const named = (name: string) => resolve(name);

  const goals = model.ofKind('goal');
  const tasks = model.ofKind('task');
  const qualities = model.ofKind('quality');
  const conditions = model.ofKind('condition');
  const root = goals.find((goal) => isTrue(goal.properties.root))!;
  const rootName = root.identifier;

  // `DecompositionElement.isRoot`: a goal's own `root`, a task's having no parent
  const isRoot = (element: IstardtElement) =>
    element.kind === 'goal'
      ? isTrue(element.properties.root)
      : !model.parentOf(element);

  /** `getORSiblings`: the siblings under every OR ancestor, nearest first. */
  const orSiblings = (element: IstardtElement): IstardtElement[] => {
    const out: IstardtElement[] = [];
    for (let e = element; !isRoot(e);) {
      const parent = model.parentOf(e);
      if (!parent) break;
      const { relation, children } = model.refinement(parent);
      if (relation === 'OR') out.push(...children.filter((c) => c !== e));
      e = parent;
    }
    return out;
  };

  /** A precedence link's source, as a condition on the situation. */
  const precedenceTerm = (source: IstardtElement) =>
    source.kind === 'condition'
      ? `${fluent(source.identifier)}(S)`
      : `${sat(source.identifier)}(S)`;

  /** `getPreFormulae`: the pre links of every ancestor, nearest first. */
  const ancestorsPre = (element: IstardtElement): string[] => {
    const out: string[] = [];
    for (let e = element; !isRoot(e);) {
      const parent = model.parentOf(e);
      if (!parent) break;
      out.push(...model.pre(parent).map(precedenceTerm));
      e = parent;
    }
    return out;
  };

  /* Preliminary */
  const header =
    ':-style_check(-discontiguous).\n' +
    ':-style_check(-singleton).\n' +
    ':- multifile getRewardMode/1.\n' +
    ':- multifile getRewardModeDTG/1.\n' +
    ':- multifile deadlockPenalty/1.\n' +
    ':- multifile getInfeasiblePenalty/1.\n' +
    ':- multifile val/2.\n' +
    ':-dynamic(init/1).\n\n';
  const numRuns = `getNumRuns(${Number.parseInt(root.properties.episodeLength ?? '1', 10) || 1}).`;
  const problemType = `getObsType(${continuous ? 'continuous' : 'discrete'}).\n`;

  // the exported set: goals and tasks by their satisfaction, predicates by
  // their fluent; qualities and variables continuous; conditions dropped
  let discreteExportedSet =
    '%\n% D I S C R E T E   E X P O R T S\n%\ndiscreteExportedSet([';
  let continuousExportedSet =
    '%\n% C O N T I N U O U S   E X P O R T S\n%\ncontinuousExportedSet([';
  let discreteEmpty = true;
  let continuousEmpty = true;
  for (const name of model.exported) {
    const element = named(name);
    if (!element) continue;
    const id = element.identifier;
    if (element.kind === 'goal' || element.kind === 'task') {
      discreteExportedSet += `${id}_Sat,`;
      discreteEmpty = false;
    } else if (element.kind === 'predicate') {
      discreteExportedSet += `${id}_fl,`;
      discreteEmpty = false;
    } else if (element.kind === 'quality' || element.kind === 'variable') {
      const bound = (key: 'exportMin' | 'exportMax') =>
        javaFloat(Number(element.properties[key] ?? '0') || 0);
      continuousExportedSet += `[${id}(_),${bound('exportMin')},${bound('exportMax')}], `;
      continuousEmpty = false;
    }
  }
  discreteExportedSet = discreteEmpty
    ? `${discreteExportedSet}]).\n`
    : `${chop(discreteExportedSet)}]).\n`;
  continuousExportedSet = continuousEmpty
    ? `${continuousExportedSet}]).\n`
    : `${chop(continuousExportedSet, 2)}]).\n`;

  let crossRunSet = '%\n% C R O S S   S T A T E \n%\ntransStateStructure([';
  for (const name of model.crossRun) {
    const element = named(name);
    if (!element) continue;
    if (element.kind === 'predicate' || element.kind === 'condition')
      crossRunSet += `${element.identifier}_fl,`;
    else if (element.kind === 'variable' || element.kind === 'quality')
      crossRunSet += `${element.identifier}(_),`;
  }
  crossRunSet = `${chop(crossRunSet)}]).\n`;

  let initList = 'init([';
  if (model.initializations.length) {
    for (const [name, value] of model.initializations) {
      const element = named(name);
      if (!element) continue;
      if (element.kind === 'predicate' || element.kind === 'condition')
        initList += `${name}_fl,`;
      else if (element.kind === 'variable') initList += `${name}_fl(${value}),`;
      else if (element.kind === 'quality') initList += `${name}(${value}),`;
    }
    initList = `${chop(initList)}]).\n`;
  } else initList += ']).\n';

  /* Tasks */
  let agentActionList = 'agentActionList([';
  let agentActions = '';
  let stochasticActionList = 'stochasticActionList([';
  let stochasticActions = '';
  let nonDetActions = '';
  let fluentList = 'fluentList([';
  let probabilities = '';
  let successorStateAxioms = '';
  let preconditionAxioms = '';
  let preconditionAxiomsTasks = '';
  let satisfactionFormulae = '';
  let satisfactionFormulaeEffects = '';
  let attemptFormulae = '';
  let senseConditions = '';
  let restoreSitArg = '';

  // what the translator leaves as TODOs (unverified): each predicate's
  // effects that turn it false, each variable's effects that set it
  const turnsFalse = new Map<string, string[]>();
  for (const task of tasks)
    for (const effect of model.effectsOf(task))
      for (const predicate of model.turnsFalse(effect))
        turnsFalse.set(predicate, [
          ...(turnsFalse.get(predicate) ?? []),
          effect.identifier,
        ]);
  const falsified = (predicate: string) =>
    (turnsFalse.get(predicate) ?? [])
      .map((effect) => `\\+ A=${effect}`)
      .join(',');

  for (const task of tasks) {
    const taskID = camelCase(task.identifier);
    let taskPrecond = '';
    agentActionList += `${taskID},`;
    agentActions += `agentAction(${taskID}).\n`;
    nonDetActions += `nondetActions(${taskID},_,[`;
    let localSatFormula = '';
    let localAttFormula = '';
    const effects = model.effectsOf(task);

    for (const effect of effects) {
      const effectID = effect.identifier;
      const localPreconditions: string[] = [];
      taskPrecond += `poss(${effectID},S);`;
      stochasticActionList += `${effectID},`;
      stochasticActions += `stochasticAction(${effectID}).\n`;
      nonDetActions += `${effectID},`;
      probabilities += `prob(${effectID},${javaFloat(Number(model.probabilityOf(effect) ?? '1'))},_).\n`;
      let effectSatFormula = `${effectID}_Sat(S) :- `;
      const satisfying = effect.properties.satisfying?.trim() !== 'false';

      for (const pred of model.turnsTrue(effect)) {
        const kept = falsified(pred);
        fluentList += `${fluent(pred)},`;
        successorStateAxioms += kept
          ? `${fluent(pred)}(do(A,S)) :- (${fluent(pred)}(S),${kept}); A=${effectID}.\n`
          : `${fluent(pred)}(do(A,S)) :- ${fluent(pred)}(S); A=${effectID}.\n`;
        senseConditions += `senseCondition(${effectID},${effectID}_Occured).\n`;
        restoreSitArg += `restoreSitArg(${fluent(pred)},S,${fluent(pred)}(S)).\n`;
        effectSatFormula += `${fluent(pred)}(S),`;
        localAttFormula += `${fluent(pred)}(S);`;
        if (satisfying) localSatFormula += `${fluent(pred)}(S);`;
      }
      satisfactionFormulaeEffects += `${chop(effectSatFormula)}.\n`;

      // the effect's preconditions: its task not attempted, nor its OR
      // siblings at any level, and the pre links of its ancestors
      localPreconditions.push(`\\+ ${taskID}_Att(S)`);
      for (const sibling of orSiblings(task))
        localPreconditions.push(`\\+ ${sibling.identifier}_Att(S)`);
      localPreconditions.push(...ancestorsPre(task));
      // unverified: the task's and the effect's own pre and npr links, and
      // the npr links of its ancestors (dtx2dtg reads none of them)
      localPreconditions.push(
        ...[task, effect].flatMap((e) => model.pre(e).map(precedenceTerm)),
        ...[task, effect, ...ancestorsOf(model, task)].flatMap((e) =>
          model.npr(e).map((source) => `\\+ ${precedenceTerm(source)}`),
        ),
      );
      preconditionAxioms += `poss(${effectID},S) :- ${localPreconditions.join(',')}.\n`;
    }

    satisfactionFormulae += `${sat(taskID)}(S) :- ${chop(localSatFormula)}.\n`;
    attemptFormulae += `${att(taskID)}(S) :- ${chop(localAttFormula)}.\n`;
    preconditionAxiomsTasks += taskPrecond
      ? `poss(${taskID},S) :- (${chop(taskPrecond)}).\n`
      : `poss(${taskID},S).\n`;
    restoreSitArg += `restoreSitArg(${sat(taskID)},S,${sat(taskID)}(S)).\n`;
    restoreSitArg += `restoreSitArg(${att(taskID)},S,${att(taskID)}(S)).\n`;
    nonDetActions = `${chop(nonDetActions)}]).\n`;
  }
  agentActionList = `${chop(agentActionList)}]).\n`;
  stochasticActionList = `${chop(stochasticActionList)}]).\n`;

  // unverified: a variable's successor-state axiom, from the effects that set it
  for (const variable of model.ofKind('variable')) {
    const id = variable.identifier;
    const setters = tasks.flatMap((task) =>
      model.effectsOf(task).flatMap((effect) =>
        pairItems(effect.properties.set)
          .filter(([name]) => name === id)
          .map(([, value]) => ({ effect: effect.identifier, value })),
      ),
    );
    // the initializations write a variable as `<id>_fl(value)`, as dtx2dtg
    successorStateAxioms += `${id}(V,s0) :- getInitValue(${id}_fl,V),!.\n`;
    for (const { effect, value } of setters) {
      const term = readExpression(value);
      const constant = term && termOf(term, resolve);
      if (constant?.kind !== 'number') {
        fail(variable, `an effect sets ${id} to a number, not ${value}`);
        continue;
      }
      successorStateAxioms += `${id}(V,do(A,S)) :- A=${effect},!,V is ${constant.value}.\n`;
    }
    successorStateAxioms += `${id}(V,do(_,S)) :- ${id}(V,S).\n`;
    restoreSitArg += `restoreSitArg(${id}(X),S,${id}(X,S)).\n`;
  }

  /* Goals */
  let procedures = '';
  for (const goal of goals) {
    const goalID = camelCase(goal.identifier);
    const { relation, children } = model.refinement(goal);
    const procOp = relation === 'AND' ? ' : ' : relation === 'OR' ? ' # ' : '';
    const formOp = relation === 'AND' ? ',' : relation === 'OR' ? ';' : '';
    if (!relation)
      fail(
        goal,
        `${goal.id ?? goalID} is refined by AND or by OR links, not ${children.length ? 'both' : 'none'}`,
      );
    let localSatFormula = `${goalID}_Sat(S) :- `;
    let localAttFormula = `${goalID}_Att(S) :- `;
    const procChildren = children.map((child) => camelCase(child.identifier));
    for (const childID of procChildren) {
      localSatFormula += `${childID}_Sat(S)${formOp}`;
      localAttFormula += `${childID}_Att(S);`;
    }
    let procLine = '';
    if (relation === 'AND')
      for (const permute of permutations(procChildren))
        procLine += `proc(${goalID}, ${permute}).\n`;
    else
      procLine = `${chop(
        `proc(${goalID}, ${procChildren.map((c) => c + procOp).join('')}`,
        3,
      )}).\n`;
    restoreSitArg += `restoreSitArg(${sat(goalID)},S,${sat(goalID)}(S)).\n`;
    restoreSitArg += `restoreSitArg(${att(goalID)},S,${att(goalID)}(S)).\n`;
    satisfactionFormulae += `${chop(localSatFormula)}.\n`;
    attemptFormulae += `${chop(localAttFormula)}.\n`;
    procedures += procLine;
  }
  const rootSat = `goalAchieved(S) :- ${rootName}_Sat(S).\n`;
  procedures +=
    `dtgRun :- write('Policy: '), bp(${rootName},10,_,U,P,x),nl,` +
    "\n        write('Utility: '),writeln(U), " +
    "\n        write('Probability: '),writeln(P).\n";
  procedures += `dtgRun(L,U,P) :-  with_output_to(string(_),bp(${rootName},10,L,U,P,x)).\n`;

  /* Qualities */
  let rewardFormulae = '';
  let rewardTotal = '';
  const crossRun = new Set(model.crossRun);
  for (const quality of qualities) {
    const name = quality.identifier;
    const formula = qualityFormula(model, quality, resolve, (message) =>
      fail(quality, message),
    );
    if (!formula) continue;
    const head = `${name}(V_init,s0) :- getInitValue(${name},V_init),!.\n`;
    const indent = ' '.repeat(`${name}(0,s0) :- `.length);
    const addInit = !readsPreviousOf(quality, formula) && crossRun.has(name);
    const lookups = qualityLookups(formula, indent);
    const value = qualityValue(formula);
    rewardFormulae += addInit
      ? `${head}${name}(V,S) :-${name}(R_${name}_init,s0),\n${lookups}${indent}V is R_${name}_init +\n${value}.\n\n\n`
      : `${head}${name}(V,S) :- \n${lookups}${indent}V is \n${value}.\n\n\n`;
    restoreSitArg += `restoreSitArg(${name}(X),S,${name}(X,S)).\n`;
    if (isTrue(quality.properties.root))
      rewardTotal = `rewardInst(R,S) :- ${name}(R,S).\n`;
  }
  rewardFormulae += `\n${rewardTotal}\n`;

  satisfactionFormulae += '\n\n% Condition Box Related\n';
  for (const condition of conditions) {
    const name = condition.identifier;
    let body = '';
    try {
      body = conditionText(
        readAssertion(condition.properties.formula ?? ''),
        resolve,
      );
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      fail(condition, `${condition.id ?? name}'s formula: ${error.message}`);
    }
    satisfactionFormulae += `${name}_fl(s0) :- !,initiallyTrue(${name}_fl).\n`;
    satisfactionFormulae += `${name}_fl(S) :- ${body}.\n`;
    restoreSitArg += `restoreSitArg(${name}_fl,S,${name}_fl(S)).\n`;
  }
  satisfactionFormulae += `\n\n% Effect Related\n${satisfactionFormulaeEffects}\n`;
  fluentList = `${chop(fluentList)}]).\n`;

  if (problems.length) throw new IstardtWriteError(problems);

  return (
    `% DT-Golog Specification for Model: ${modelName} \n` +
    `% Date Translated: ${date} \n` +
    `% From source: ${modelName} \n` +
    '% Using DTTRanslate \n' +
    `${header}\n\n` +
    '%\n% OPTIONS \n% \n\n' +
    `${numRuns}\n` +
    `${problemType}\n` +
    '\n\n%\n% CROSS-RUN ELEMENTS \n% \n\n' +
    `${crossRunSet}\n\n` +
    '\n\n%\n% EXPORTED STATE ELEMENTS \n% \n\n' +
    `${discreteExportedSet}\n\n` +
    `${continuousExportedSet}\n\n` +
    '\n\n%\n% INITIALIZATIONS \n% \n\n' +
    `${initList}\n\n` +
    '\n\n%\n% ACTION LISTS \n% \n\n' +
    `${agentActionList}\n` +
    `${agentActions}\n` +
    `${stochasticActionList}\n` +
    `${stochasticActions}\n` +
    `${nonDetActions}\n` +
    `${probabilities}\n` +
    '\n\n%\n% PROCEDURES \n% \n\n' +
    `${procedures}\n` +
    '\n\n%\n% FLUENT LISTS \n% \n\n' +
    `${fluentList}\n` +
    '%\n% SUCCESSOR STATE AXIOMS \n% \n\n' +
    `${successorStateAxioms}\n` +
    '%\n% PRECONDITION AXIOMS \n% \n\n' +
    `${preconditionAxioms}\n\n` +
    `${preconditionAxiomsTasks}\n` +
    '%\n% SATISFACTION FORMULAE \n% \n\n' +
    `${satisfactionFormulae}\n` +
    '%\n% ATTEMPT FORMULAE \n% \n\n' +
    `${attemptFormulae}\n` +
    '%\n% ROOT SATISFACTION \n% \n\n' +
    `${rootSat}\n` +
    '%\n% REWARD FORMULAE \n% \n\n' +
    `${rewardFormulae}\n` +
    '%\n% SENSE CONDITIONS \n% \n\n' +
    `${senseConditions}\n` +
    '%\n% RESTORE SITUATION ARGUMENT \n% \n\n' +
    `${restoreSitArg}\n`
  );
};

const ancestorsOf = (model: IstardtModel, element: IstardtElement) => {
  const out: IstardtElement[] = [];
  const seen = new Set<IstardtElement>();
  for (
    let p = model.parentOf(element);
    p && !seen.has(p);
    p = model.parentOf(p)
  ) {
    seen.add(p);
    out.push(p);
  }
  return out;
};

/**
 * A quality's formula as a term: its `formula`, or the weighted sum its
 * utility links are (#117 D3, mx2dtx's contribution links), in their order:
 * `weight × q` for a quality, `weight × p` for an effect that turns the
 * predicate `p` true (istardtProblems has checked it has one or the other).
 */
const qualityFormula = (
  model: IstardtModel,
  quality: IstardtElement,
  resolve: Resolve,
  fail: (message: string) => void,
) => {
  const text = quality.properties.formula?.trim() ?? '';
  const utilities = model.utilities(quality);
  // an effect weighs by the one predicate it turns true (checked)
  const terms = utilities.map(
    ({ source, weight }) =>
      `${weight || '1'} * ${source.kind === 'effect' ? model.turnsTrue(source)[0] : source.identifier}`,
  );
  const source = text || terms.join(' + ');
  const tree = readExpression(source);
  if (!tree) {
    fail(
      `${quality.id ?? quality.identifier}'s formula is not an expression: ${source}`,
    );
    return null;
  }
  try {
    return termOf(tree, resolve);
  } catch (error) {
    if (!(error instanceof FormulaError)) throw error;
    fail(`${quality.id ?? quality.identifier}'s formula: ${error.message}`);
    return null;
  }
};

/** The DT-Golog file of a model in the iStar-DT dialect: one output, `dtgolog`. */
export const istardtOutput = (
  model: AnalysisModel,
  options: IstardtWriteOptions,
): EngineOutput =>
  singleFileOutput({
    id: 'dtgolog',
    modelName: options.modelName,
    extension: 'pl',
    language: 'prolog',
    text: istardtTemplate(readIstardtModel(model), options),
  });
