/**
 * GODA's model of a goal tree before it is written: RTGoreProducer's goal and
 * plan containers (`model/kl/{RT,Goal,Plan}Container.java`,
 * `generator/kl/AgentDefinition.java`), with the time slots that sequence
 * their PRISM modules, as the producer at cc808b6 computes them.
 */
import {
  operandIds,
  type CostData,
  type RtTree,
} from '@goal-controller/goal-language';
import type { GodaGoalNode, GodaTask } from '../mapper';

export type Decomposition = 'AND' | 'OR' | 'ME' | 'NONE';

export type Container = {
  kind: 'goal' | 'plan';
  /** the element's text with its whitespace made `_` (`NameUtility.adjustName`) */
  name: string;
  /** its RT id as written (`T1.1`); a plan's `getElId` is `<uid>_<elId>` */
  elId: string;
  /** the goal it is scoped by: its own id for a goal, its nearest goal's for a plan */
  uid: string;
  annotation: RtTree | null;
  decomposition: Decomposition;
  goals: Container[];
  plans: Container[];
  root: Container | null;
  timeSlot: number;
  /** the slot it starts after (the 2019-07 producer's; cc808b6 counts from its time path) */
  prevTimeSlot: number;
  rootTimeSlot: number;
  timePath: number;
  prevTimePath: number;
  futTimePath: number;
  /** the elements a decision-making annotation chooses between (`getElId`s) */
  decisionMaking: string[];
  optional: boolean;
  included: boolean;
  fulfillmentConditions: string[];
  cost: CostData | null;
};

/** `NameUtility.adjustName`: line breaks, tabs and spaces become `_`. */
export const adjustName = (source: string): string =>
  source.replace(/(\r\n)|[\t\n\r\u0085\u2028\u2029 ]/g, '_');

/** `RTContainer.getElId` (a plan's is scoped by its goal: `G1_T1.1`). */
export const elIdOf = (c: Container): string =>
  c.kind === 'plan' ? `${c.uid}_${c.elId}` : c.elId;

/** `getClearElId`: the element id PRISM names it by (`G1_T1_1`). */
export const clearElId = (c: Container): string =>
  elIdOf(c).replace(/\./g, '_');

/** `getClearUId`: a goal's id in the formulas (`G1`). */
export const clearUid = (c: Container): string =>
  (c.root ? c.uid : c.elId).replace(/\./g, '_');

/** A formula's name for a node: a goal's uid, a plan's element id (`composeNodeForm`). */
export const nodeIdOf = (c: Container): string =>
  c.kind === 'goal' ? clearUid(c) : clearElId(c);

/**
 * `getClearElName`: a module's name, the element's words capitalised and
 * joined (`G1_T1_1_Task`). Upstream strips only an RT regex's bracket; a
 * leaf's cost bracket would stay in the name, which PRISM can't read: it is
 * stripped too.
 */
export const clearElName = (c: Container): string => {
  const words = adjustName(c.name.replace(/\s*\[.*\]\s*$/s, ''))
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  const name = words.join('').replace(/[:.-]/g, '_');
  return c.kind === 'plan' ? `${c.uid}_${name}` : name;
};

/**
 * `sortIntentionalElements`: siblings by id. Ids whose letters agree (`T1.1`,
 * `T1.10`) compare by their digits read as one number (`11`, `110`);
 * others by text, ignoring case. A stable sort, as `Collections.sort`.
 */
const byId = (a: { id: string }, b: { id: string }): number => {
  const idA = a.id.replace(/[TG]/g, '');
  const idB = b.id.replace(/[TG]/g, '');
  const digits = (s: string) => {
    const num = s.replace(/\D/g, '');
    return num ? parseInt(num, 10) : 0;
  };
  if (
    idA.replace(/\d/g, '').toLowerCase() ===
    idB.replace(/\d/g, '').toLowerCase()
  )
    return digits(idA) - digits(idB);
  const [lowerA, lowerB] = [idA.toLowerCase(), idB.toLowerCase()];
  return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0;
};
/** Siblings in the order a generator visits them. */
export type SiblingOrder = <T extends { id: string }>(
  items: readonly T[],
) => T[];
export const sortedById: SiblingOrder = (items) => [...items].sort(byId);

/** An actor's root goals, and which goal is the selected one. */
export type GodaRoots = {
  roots: readonly GodaGoalNode[];
  selected: (goal: GodaGoalNode) => boolean;
};

/** What the generator does not read yet (each model's own issue). */
export class GodaUnsupported extends Error {
  constructor(what: string, issue: string) {
    super(`GODA: ${what} is not generated yet (${issue})`);
    this.name = 'GodaUnsupported';
  }
}

/**
 * The ids a decision-making annotation chooses between (`RTParser`'s
 * `decisionMemory`): a task's scoped by the goal of the element it is on.
 */
const decisionIds = (annotation: RtTree | null, uid: string): string[] => {
  const ids: string[] = [];
  const visit = (tree: RtTree | null): void => {
    if (!tree) return;
    if (tree.kind === 'call' && tree.name === 'DM')
      for (const arg of tree.args)
        for (const id of operandIds(arg))
          ids.push(id.startsWith('T') ? `${uid.split('_')[0]}_${id}` : id);
    else if (
      tree.kind === 'group' ||
      tree.kind === 'prefix' ||
      tree.kind === 'postfix'
    )
      visit(tree.expr);
    else if (tree.kind === 'binary') {
      visit(tree.left);
      visit(tree.right);
    } else if (tree.kind === 'call') tree.args.forEach(visit);
  };
  visit(annotation);
  return [...new Set(ids)];
};

/**
 * How a version of RTGoreProducer sequences the containers (D14): the slots
 * a container starts with, a child's before it is read, and its parent's
 * after; one instance per model (the July 2019 one keeps the largest slots
 * a decision-making element's children reached).
 */
export type TimeSlots = {
  /** a new container's slots (RTContainer's defaults) */
  initial: Pick<Container, 'timeSlot' | 'prevTimeSlot'>;
  /** whether a child is read with its parent's context conditions too */
  inheritsConditions: boolean;
  /** a decomposed child, before it is read: whether it is first, whether an annotation decides it */
  child: (
    parent: Container,
    child: Container,
    how: { first: boolean; decided: boolean; start: TimePaths },
  ) => void;
  /** the parent, after a new child was read */
  afterChild: (parent: Container, child: Container) => void;
  /** a goal's means-end task, before it is read, and the goal after */
  meansEnd: (goal: Container, plan: Container) => void;
  afterMeansEnd: (goal: Container, plan: Container) => void;
  /** an element with a decision-making annotation, after its children */
  afterDecisionMaking: (c: Container) => void;
};

/** A parent's time paths when it starts reading its children. */
type TimePaths = Pick<Container, 'prevTimePath' | 'futTimePath' | 'timePath'>;

/** cc808b6's (2019-01): time paths; a child an annotation decides goes one path further. */
export const timePaths = (): TimeSlots => ({
  initial: { timeSlot: 0, prevTimeSlot: 0 },
  inheritsConditions: true,
  child: (parent, dec, { first, decided, start }) => {
    if (decided) {
      dec.prevTimePath = parent.prevTimePath + 1;
      dec.futTimePath = parent.futTimePath + 1;
      dec.timePath = start.timePath + 1;
      dec.timeSlot = dec.prevTimePath + 1;
      if (!first) dec.futTimePath = start.timePath + 1;
    } else if (!first) {
      dec.prevTimePath = parent.futTimePath;
      dec.futTimePath = parent.futTimePath + 1;
      dec.timePath = start.timePath;
      dec.timeSlot = dec.prevTimePath + 1;
    } else {
      dec.prevTimePath = start.prevTimePath;
      dec.futTimePath = start.futTimePath;
      dec.timePath = start.timePath;
      dec.timeSlot = start.prevTimePath + 1;
    }
  },
  afterChild: (parent, dec) => {
    parent.futTimePath = Math.max(dec.timeSlot, dec.futTimePath);
  },
  meansEnd: (gc, pc) => {
    pc.prevTimePath = gc.prevTimePath;
    pc.futTimePath = gc.futTimePath;
    pc.timePath = gc.timePath;
    pc.timeSlot = gc.prevTimePath + 1;
  },
  afterMeansEnd: (gc, pc) => {
    gc.futTimePath = Math.max(pc.timeSlot, pc.futTimePath);
  },
  afterDecisionMaking: () => {},
});

/**
 * 5305bc1's (2019-07, RTGoreProducer's prevMax/timeSlotMax): a container
 * starts at slot 1 after 0; a decision-making element's children one slot
 * further, its parent after the furthest of them; any other parent after
 * its child. Children no longer inherit their parent's conditions.
 */
export const maxSlots = (): TimeSlots => {
  let prevMax = 0;
  let timeSlotMax = 1;
  const decides = (c: Container) => c.decisionMaking.length > 0;
  const follow = (parent: Container, from: Container, step: number) => {
    parent.prevTimeSlot = from.prevTimeSlot + step;
    parent.timeSlot = from.timeSlot + step;
  };
  return {
    initial: { timeSlot: 1, prevTimeSlot: 0 },
    inheritsConditions: false,
    child: (parent, dec) => follow(dec, parent, decides(parent) ? 1 : 0),
    afterChild: (parent, dec) => {
      if (dec.kind === 'goal') {
        if (decides(parent)) {
          prevMax = dec.prevTimeSlot + 1;
          timeSlotMax = dec.timeSlot + 1;
        } else if (decides(dec)) {
          parent.timeSlot = timeSlotMax;
          parent.prevTimeSlot = prevMax;
        } else follow(parent, dec, 0);
        return;
      }
      const leaf = dec.plans.length === 0 ? 1 : 0;
      if (decides(parent)) {
        prevMax = Math.max(prevMax, dec.prevTimeSlot + leaf);
        timeSlotMax = Math.max(timeSlotMax, dec.timeSlot + leaf);
      } else follow(parent, dec, leaf);
    },
    meansEnd: (gc, pc) => follow(pc, gc, 0),
    afterMeansEnd: (gc, pc) => {
      if (pc.plans.length === 0) follow(gc, pc, 1);
      else if (decides(pc)) {
        gc.prevTimeSlot = prevMax;
        gc.timeSlot = timeSlotMax;
      } else follow(gc, pc, 0);
    },
    afterDecisionMaking: (c) => {
      if (!c.root) return;
      c.root.timeSlot = timeSlotMax;
      c.root.prevTimeSlot = prevMax;
    },
  };
};

/** The containers of one actor's goal tree, and its root goals, as RTGoreProducer builds them. */
export const buildContainers = (
  { roots, selected }: GodaRoots,
  { siblings: sorted, slots }: { siblings: SiblingOrder; slots: TimeSlots },
): Container[] => {
  // AgentDefinition's goal and plan bases: an element is one container per text
  const goalBase = new Map<string, Container>();
  const planBase = new Map<string, Container>();
  // the decision-making operands of every annotation read so far (RTGoreProducer.rtDMGoals)
  const rtDMGoals: string[] = [];

  const container = (
    kind: Container['kind'],
    node: GodaGoalNode | GodaTask,
  ): Container => ({
    kind,
    name: adjustName(node.properties.engine.text),
    elId: node.id,
    uid: node.id,
    annotation: node.properties.engine.annotation,
    decomposition: 'NONE',
    goals: [],
    plans: [],
    root: null,
    ...slots.initial,
    rootTimeSlot: 0,
    timePath: 0,
    prevTimePath: 0,
    futTimePath: 0,
    decisionMaking: [],
    optional: false,
    included: false,
    fulfillmentConditions: [...node.properties.engine.contexts],
    cost: node.type === 'task' ? node.properties.engine.cost : null,
  });
  const createGoal = (goal: GodaGoalNode) => {
    const name = adjustName(goal.properties.engine.text);
    const existing = goalBase.get(name);
    if (existing) return { container: existing, isNew: false };
    const made = container('goal', goal);
    goalBase.set(name, made);
    return { container: made, isNew: true };
  };
  const createPlan = (task: GodaTask) => {
    const name = adjustName(task.properties.engine.text);
    const existing = planBase.get(name);
    if (existing) return { container: existing, isNew: false };
    const made = container('plan', task);
    planBase.set(name, made);
    return { container: made, isNew: true };
  };
  // GoalContainer/PlanContainer.setRoot: a goal's uid is its own id, a plan's its root's
  const setRoot = (child: Container, root: Container) => {
    child.root = root;
    child.uid = child.kind === 'goal' ? child.elId : root.uid;
  };

  /** storeRegexResults: whether its annotation decides between operands */
  const storeRegexResults = (c: Container): boolean => {
    const ids = decisionIds(c.annotation, c.uid);
    rtDMGoals.push(...ids);
    return ids.length > 0;
  };

  const addGoal = (goal: GodaGoalNode, gc: Container, inherited: boolean) => {
    const included = inherited || selected(goal);
    gc.included = included;
    const dm = storeRegexResults(gc);
    const children = sorted(goal.children ?? []);
    if (goal.relationToChildren === 'and' && children.length)
      gc.decomposition = 'AND';
    else if (goal.relationToChildren === 'or' && children.length)
      gc.decomposition = 'OR';
    // the producer keeps one list of every annotation's operands, shared by every goal that has one
    if (dm) gc.decisionMaking = rtDMGoals;
    iterateGoals(gc, children, included);
    iterateMeansEnds(goal, gc, included);
    if (gc.decisionMaking.length) slots.afterDecisionMaking(gc);
    // upstream makes it optional with an unknown plan TX, built from the goal
    // (`new PlanContainer((Plan) gc)`): a cast that fails, so no model has one
    if (clearElId(gc).includes('X'))
      throw new Error(
        `GODA: an incomplete goal (${gc.elId}) is not generated: upstream's generator fails on it`,
      );
  };

  const iterateGoals = (
    gc: Container,
    children: GodaGoalNode[],
    included: boolean,
  ) => {
    const start: TimePaths = { ...gc };
    gc.rootTimeSlot = gc.timeSlot;
    for (const child of children) {
      const first = gc.goals.length === 0;
      const { container: dec, isNew } = createGoal(child);
      gc.goals.push(dec);
      setRoot(dec, gc);
      const decided = rtDMGoals.includes(elIdOf(dec));
      slots.child(gc, dec, { first, decided, start });
      if (slots.inheritsConditions)
        dec.fulfillmentConditions.push(...gc.fulfillmentConditions);
      if (isNew) {
        addGoal(child, dec, included);
        slots.afterChild(gc, dec);
      }
    }
  };

  const addPlan = (task: GodaTask, pc: Container) => {
    const children = sorted(task.tasks);
    pc.decomposition =
      task.relationToChildren === 'and' && children.length ? 'AND' : 'OR';
    let dm = false;
    // a leaf's bracket is its cost (RTGoreProducer: its rtRegex becomes its costRegex)
    if (children.length) dm = storeRegexResults(pc);
    if (dm) pc.decisionMaking = rtDMGoals;
    iteratePlans(pc, children);
    if (pc.decisionMaking.length) slots.afterDecisionMaking(pc);
    // an incomplete task (`T1.X`): optional, pursued or skipped
    if (clearElId(pc).includes('X')) pc.optional = true;
  };

  const iteratePlans = (pc: Container, children: GodaTask[]) => {
    const start: TimePaths = { ...pc };
    for (const child of children) {
      const first = pc.plans.length === 0;
      const { container: dec, isNew } = createPlan(child);
      pc.plans.push(dec);
      setRoot(dec, pc);
      const decided = rtDMGoals.includes(elIdOf(dec));
      slots.child(pc, dec, { first, decided, start });
      if (slots.inheritsConditions)
        dec.fulfillmentConditions.push(...pc.fulfillmentConditions);
      if (isNew) {
        addPlan(child, dec);
        slots.afterChild(pc, dec);
      }
    }
  };

  const iterateMeansEnds = (
    goal: GodaGoalNode,
    gc: Container,
    included: boolean,
  ) => {
    const tasks = goal.tasks ?? [];
    if (!included || !tasks.length) return;
    gc.decomposition = 'ME';
    for (const task of sorted(tasks)) {
      const { container: pc, isNew } = createPlan(task);
      // GoalContainer.addMERealPlan
      gc.plans.push(pc);
      setRoot(pc, gc);
      slots.meansEnd(gc, pc);
      if (slots.inheritsConditions)
        pc.fulfillmentConditions.push(...gc.fulfillmentConditions);
      if (isNew) {
        addPlan(task, pc);
        slots.afterMeansEnd(gc, pc);
      }
    }
  };

  return roots.map((root) => {
    const { container: gc } = createGoal(root);
    addGoal(root, gc, false);
    return gc;
  });
};
