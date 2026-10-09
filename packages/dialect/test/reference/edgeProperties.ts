// Pinned from vn/rt-langium-notation @ b61def8: packages/ui/lib/workbench/edgeProperties.ts
// (scripts/sync-reference.sh; do not edit)
/**
 * How the Edge engines (Edge, EdgeV2) read each custom property, for the Inspector: the
 * input to edit it with, whether it applies given the element's other properties (an int
 * resource has bounds, a bool one does not; a maintain goal needs a maintain condition),
 * and what the engine would reject in it (`validate`, the engine's own check function —
 * see @goal-controller/lib's edge{Goal,Task,Resource}Checks, shared by both engines today).
 * Mirrors packages/lib/src/engines/edge{,V2}/mapper.ts.
 */
import {
  edgeEngineMapper,
  edgeV2EngineMapper,
  edgeGoalChecks,
  edgeTaskChecks,
  edgeResourceChecks,
  firstResourceIssue,
  type Check,
} from '../../../lib/out';

export { firstResourceIssue };

export type Properties = Readonly<Record<string, string | undefined>>;

/** piStar's resource yellow: Edge resources are drawn with it unless they have a colour. */
export const EDGE_RESOURCE_FILL = '#FAF383';
/** The default fill of an intentional element (the istar-ts canvas, as piStar). */
export const DEFAULT_ELEMENT_FILL = '#CDFECD';

export type PropertyInput =
  | { kind: 'text'; placeholder?: string }
  | { kind: 'long'; placeholder?: string }
  | { kind: 'integer'; min?: number }
  | { kind: 'number' }
  /** `''` stands for "not set" (the property is removed) */
  | {
      kind: 'select';
      options: ReadonlyArray<{ value: string; label: string }>;
    };

export type PropertySpec<K extends string = string> = {
  key: K;
  /** how to edit it; may depend on the other properties (a resource's initial value) */
  input: PropertyInput | ((properties: Properties) => PropertyInput);
  /** whether the engine reads it, given the other properties (default: always) */
  applies?: (properties: Properties) => boolean;
  /** why it does not apply, for a value that is set anyway */
  notApplying?: (properties: Properties) => string;
  /** shown as a row even when unset (the engine needs it) */
  required?: (properties: Properties) => boolean;
  /** what the engine would reject in a value (null when fine); the engine's own check */
  validate?: Check;
};

/** The keys an engine mapper reads, per node kind. */
type KeysOf<M> = M extends {
  allowedGoalKeys: readonly (infer G)[];
  allowedTaskKeys: readonly (infer T)[];
  allowedResourceKeys: readonly (infer R)[];
}
  ? {
      goal: G;
      task: T;
      resource: R;
      quality: M extends { allowedQualityKeys: readonly (infer Q)[] }
        ? Q
        : never;
    }
  : never;

/** A spec list per node kind, each entry's key checked against the engine's keys. */
type SpecsFor<M> = {
  [K in keyof KeysOf<M>]: readonly PropertySpec<KeysOf<M>[K] & string>[];
};

type EdgeKeys = KeysOf<typeof edgeEngineMapper>;

/** The node kinds an engine mapper has keys for. */
export type NodeKindKey = keyof EdgeKeys;

const isMaintain = (p: Properties) => p.type === 'maintain';
const isInt = (p: Properties) => p.type === 'int';

const GOAL_TYPE: PropertyInput = {
  kind: 'select',
  options: [
    { value: '', label: 'achieve (default)' },
    { value: 'maintain', label: 'maintain' },
  ],
};

/** utility, cost: the same key set on both goals and tasks, both engines, no engine check. */
const SHARED: readonly PropertySpec<'utility' | 'cost'>[] = [
  { key: 'utility', input: { kind: 'number' } },
  { key: 'cost', input: { kind: 'number' } },
];

const GOAL_SPECS: readonly PropertySpec<EdgeKeys['goal']>[] = [
  // always offered as a choice: unset is "achieve", the default
  { key: 'type', input: GOAL_TYPE, required: () => true },
  {
    key: 'maintain',
    input: {
      kind: 'long',
      placeholder: 'condition kept while the goal is pursued',
    },
    applies: isMaintain,
    required: isMaintain,
    notApplying: () => 'Only read when type is maintain',
    validate: edgeGoalChecks.maintain,
  },
  {
    key: 'assertion',
    input: { kind: 'long', placeholder: 'condition, e.g. battery > 20' },
    required: isMaintain,
    validate: edgeGoalChecks.assertion,
  },
  {
    key: 'maxRetries',
    input: { kind: 'integer', min: 0 },
    validate: edgeGoalChecks.maxRetries,
  },
  ...SHARED,
  {
    key: 'dependsOn',
    input: { kind: 'text', placeholder: 'goal ids, comma-separated: G2, G5' },
    validate: edgeGoalChecks.dependsOn,
  },
  {
    key: 'variables',
    input: { kind: 'text', placeholder: 'decision variables, name:space, …' },
    validate: edgeGoalChecks.variables,
  },
];

const TASK_SPECS: readonly PropertySpec<EdgeKeys['task']>[] = [
  // tasks have no maintain condition (not among the task keys): type is free text
  { key: 'type', input: { kind: 'text' } },
  {
    key: 'assertion',
    input: { kind: 'long', placeholder: 'condition, e.g. battery > 20' },
  },
  {
    key: 'maxRetries',
    input: { kind: 'integer', min: 0 },
    validate: edgeTaskChecks.maxRetries,
  },
  ...SHARED,
];

const RESOURCE_SPECS: readonly PropertySpec<EdgeKeys['resource']>[] = [
  {
    key: 'type',
    input: {
      kind: 'select',
      options: [
        { value: 'bool', label: 'bool' },
        { value: 'int', label: 'int' },
      ],
    },
    required: () => true,
    validate: edgeResourceChecks.type,
  },
  {
    key: 'initialValue',
    input: (p) =>
      isInt(p)
        ? { kind: 'integer' }
        : {
            kind: 'select',
            options: [
              { value: 'true', label: 'true' },
              { value: 'false', label: 'false' },
            ],
          },
    required: () => true,
    validate: edgeResourceChecks.initialValue,
  },
  {
    key: 'lowerBound',
    input: { kind: 'integer' },
    applies: isInt,
    required: isInt,
    notApplying: (p) =>
      `Not used while type is ${p.type ?? 'unset'} (bounds are for int resources)`,
    validate: edgeResourceChecks.lowerBound,
  },
  {
    key: 'upperBound',
    input: { kind: 'integer' },
    applies: isInt,
    required: isInt,
    notApplying: (p) =>
      `Not used while type is ${p.type ?? 'unset'} (bounds are for int resources)`,
    validate: edgeResourceChecks.upperBound,
  },
];

/** Edge and EdgeV2 read the same custom properties, and check them the same way today
 * (see packages/lib/src/engines/edge{,V2}/mapper.ts and edgeChecks.ts). */
export const PROPERTY_SPECS = {
  edge: {
    goal: GOAL_SPECS,
    task: TASK_SPECS,
    resource: RESOURCE_SPECS,
    quality: [],
  },
  edgev2: {
    goal: GOAL_SPECS,
    task: TASK_SPECS,
    resource: RESOURCE_SPECS,
    quality: [],
  },
} satisfies {
  edge: SpecsFor<typeof edgeEngineMapper>;
  edgev2: SpecsFor<typeof edgeV2EngineMapper>;
};

export const inputOf = (
  spec: PropertySpec,
  properties: Properties,
): PropertyInput =>
  typeof spec.input === 'function' ? spec.input(properties) : spec.input;
