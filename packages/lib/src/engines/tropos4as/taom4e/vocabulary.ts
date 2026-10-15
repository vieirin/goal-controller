/**
 * TAOM4E's `.tropos` as its reader and its writer share it: the base
 * metamodel's classes and namespaces (`reference/TAOM4E-MM.ecore`),
 * Formal Tropos's attributes and how they map, and the goal-controller
 * extension that keeps what TAOM4E has no class for.
 */

/** The ecore's packages, by the prefix EMF writes them with (their `nsPrefix`), and their URIs. */
export const TAOM4E_NAMESPACES = {
  'it.itc.sra.taom4e.model.project':
    'http:///it/itc/sra/taom4e/model/project.ecore',
  'it.itc.sra.taom4e.model.core.informalcore':
    'http:///it/itc/sra/taom4e/model/core/informalcore.ecore',
  'it.itc.sra.taom4e.model.core.informalcore.formalcore':
    'http:///it/itc/sra/taom4e/model/core/informalcore/formalcore.ecore',
  'it.itc.sra.taom4e.model.diagram.goaldiagram':
    'http:///it/itc/sra/taom4e/model/diagram/goaldiagram.ecore',
  'it.itc.sra.taom4e.model.diagram.actordiagram':
    'http:///it/itc/sra/taom4e/model/diagram/actordiagram.ecore',
} as const;

const prefixed =
  (prefix: keyof typeof TAOM4E_NAMESPACES) =>
  (name: string): string =>
    `${prefix}:${name}`;
export const PROJECT = prefixed('it.itc.sra.taom4e.model.project');
export const INFORMAL = prefixed('it.itc.sra.taom4e.model.core.informalcore');
export const FORMAL_CORE = prefixed(
  'it.itc.sra.taom4e.model.core.informalcore.formalcore',
);
export const GOAL_DIAGRAM = prefixed(
  'it.itc.sra.taom4e.model.diagram.goaldiagram',
);
export const ACTOR_DIAGRAM = prefixed(
  'it.itc.sra.taom4e.model.diagram.actordiagram',
);

/** The base metamodel's classes, by `xsi:type`'s local name. */
export const NODE_KINDS: Readonly<Record<string, string>> = {
  HardGoal: 'istar.Goal',
  FHardGoal: 'istar.Goal',
  SoftGoal: 'istar.Quality',
  FSoftGoal: 'istar.Quality',
  Plan: 'istar.Task',
  FPlan: 'istar.Task',
  Resource: 'istar.Resource',
  FResource: 'istar.Resource',
};
/** The class each kind is written as (Formal Tropos's), its goal-diagram and actor-diagram figures. */
export const CLASS_OF_KIND: Readonly<
  Record<string, { type: string; goalUI: string; actorUI: string }>
> = {
  'istar.Goal': {
    type: 'FHardGoal',
    goalUI: 'GD_HardGoalUI',
    actorUI: 'AD_HardGoalUI',
  },
  'istar.Quality': {
    type: 'FSoftGoal',
    goalUI: 'GD_SoftGoalUI',
    actorUI: 'AD_SoftGoalUI',
  },
  'istar.Task': { type: 'FPlan', goalUI: 'GD_PlanUI', actorUI: 'AD_PlanUI' },
  'istar.Resource': {
    type: 'FResource',
    goalUI: 'GD_ResourceUI',
    actorUI: 'AD_ResourceUI',
  },
};
/** the feature a kind's element names its actor by, and the actor's feature listing it */
export const OWNER_OF_KIND: Readonly<
  Record<string, { element: string; actor: string }>
> = {
  'istar.Goal': { element: 'wanter', actor: 'wanted' },
  'istar.Quality': { element: 'wanter', actor: 'wanted' },
  'istar.Task': { element: 'capableOf', actor: 'plans' },
  'istar.Resource': { element: 'use', actor: 'resources' },
};
/** the feature a dependency names its dependum by, by the dependum's kind */
export const DEPENDUM_OF_KIND: Readonly<Record<string, string>> = {
  'istar.Goal': 'goalDependum',
  'istar.Quality': 'goalDependum',
  'istar.Task': 'planDependum',
  'istar.Resource': 'resourceDependum',
};
export const ACTORS = new Set(['Actor', 'FActor']);
export const RELATIONS = new Set([
  'BooleanDecomposition',
  'AndDecLink',
  'OrDecLink',
  'MeansEnd',
  'Contribution',
  'FContribution',
  'Dependency',
  'FDependency',
]);
/** `FContribution.metric` → iStar's contribution value */
export const METRICS: Readonly<Record<string, string>> = {
  '++': 'make',
  '+': 'help',
  '-': 'hurt',
  '--': 'break',
};
/** Formal Tropos's attributes (`formalcore`), in the ecore's order. */
export const FORMAL = [
  'mode',
  'attribute',
  'creationProperty',
  'invariantProperty',
  'fulfillmentProperty',
] as const;
/** A hard goal's, as Tropos4AS's conditions (#134, item 4's D). */
export const CONDITIONS: Readonly<Record<string, string>> = {
  creationProperty: 'creation',
  fulfillmentProperty: 'achievement',
  invariantProperty: 'maintain',
};
/** CRGMToPRISM's labels: `G1: …` for a goal, `T1.1: …` for a plan. */
export const GODA_LABEL: Readonly<Record<string, RegExp>> = {
  'istar.Goal': /^G\d+(\.\d+)*:/,
  'istar.Task': /^T\d+(\.\d+)*:/,
};

/**
 * The ecore's references (EReferences), every feature whose value names
 * nodes: what `canonical` renumbers with the ids.
 */
export const REFERENCE_FEATURES = new Set([
  'TroposClasses',
  'TroposRelations',
  'BusinessModel',
  'decomposition',
  'dependeeDependency',
  'dependerDependency',
  'contribution',
  'wanted',
  'meansEnd',
  'plans',
  'resources',
  'goalDiagrams',
  'actorDecPointOfView',
  'BooleanDecLink',
  'rootGoal',
  'rootPlan',
  'BooleanDecomposition',
  'targetGoal',
  'targetPlan',
  'dependee',
  'depender',
  'goalDependum',
  'goalWhy',
  'resourceDependum',
  'resourceWhy',
  'planDependum',
  'planWhy',
  'actorContributionPointOfView',
  'contributer',
  'contributed',
  'wanter',
  'contributeContributions',
  'contributedByContributions',
  'meansEndMeans',
  'meansEndEnd',
  'dependency',
  'dependencyWhy',
  'plan',
  'boolDecLink',
  'actorMeansEndPointOfView',
  'meansGoal',
  'end',
  'meansResource',
  'meansPlan',
  'use',
  'capableOf',
  'isFulfilled',
  'targetNode',
  'sourceNode',
  'targetConnections',
  'container',
  'Diagram',
  'sourceConnections',
  'DiagramNodes',
  'children',
  'core',
  'Actor',
]);

/**
 * The extension goal-controller writes into a `.tropos` (XMI 2.0's
 * `xmi:Extension`, which EMF and TAOM4E skip): what TAOM4E has no class or
 * attribute for (Tropos4AS's kinds, links and conditions, the piStar
 * model's own properties), so a written file reads back to its model.
 */
export const EXTENSION = 'xmi:Extension';
export const EXTENDER = 'goal-controller';
