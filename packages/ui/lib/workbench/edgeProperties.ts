/**
 * How the Edge engines (Edge, EdgeV2) read each custom property, for the Inspector: the
 * input to edit it with, and whether it applies given the element's other properties
 * (an int resource has bounds, a bool one does not; a maintain goal needs a maintain
 * condition). Mirrors packages/lib/src/engines/edge{,V2}/mapper.ts.
 */

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

export type PropertySpec = {
  key: string;
  /** how to edit it; may depend on the other properties (a resource's initial value) */
  input: PropertyInput | ((properties: Properties) => PropertyInput);
  /** whether the engine reads it, given the other properties (default: always) */
  applies?: (properties: Properties) => boolean;
  /** why it does not apply, for a value that is set anyway */
  notApplying?: (properties: Properties) => string;
  /** shown as a row even when unset (the engine needs it) */
  required?: (properties: Properties) => boolean;
  /**
   * What is wrong with a value, as the engine would reject it (null when fine). Gets the
   * element's properties with this value in place, and what else it may refer to.
   */
  validate?: (
    value: string,
    properties: Properties,
    context: ValidationContext,
  ) => string | null;
};

export type ValidationContext = {
  /** RT id of the element being edited */
  self: string;
  /** RT ids of the goals in the model (dependsOn targets) */
  goalIds: readonly string[];
};

const WHOLE = /^-?\d+$/;
const whole = (v: string | undefined): number | null =>
  v !== undefined && WHOLE.test(v.trim()) ? Number(v) : null;

const boundsError = (p: Properties): string | null => {
  const low = whole(p.lowerBound);
  const high = whole(p.upperBound);
  return low !== null && high !== null && low > high
    ? `The lower bound (${low}) is above the upper bound (${high})`
    : null;
};

const isMaintain = (p: Properties) => p.type === 'maintain';
const isInt = (p: Properties) => p.type === 'int';

const GOAL_TYPE: PropertyInput = {
  kind: 'select',
  options: [
    { value: '', label: 'achieve (default)' },
    { value: 'maintain', label: 'maintain' },
  ],
};

const SHARED: PropertySpec[] = [
  {
    key: 'maxRetries',
    input: { kind: 'integer', min: 0 },
    validate: (v) =>
      v === '' || /^\d+$/.test(v.trim())
        ? null
        : 'Use a non-negative whole number',
  },
  { key: 'utility', input: { kind: 'number' } },
  { key: 'cost', input: { kind: 'number' } },
];

export const EDGE_PROPERTIES: Record<
  'goal' | 'task' | 'resource',
  readonly PropertySpec[]
> = {
  goal: [
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
      validate: (v, p) =>
        isMaintain(p) && !v.trim()
          ? 'A maintain goal needs the condition it keeps'
          : null,
    },
    {
      key: 'assertion',
      input: { kind: 'long', placeholder: 'condition, e.g. battery > 20' },
      required: isMaintain,
      validate: (v, p) =>
        isMaintain(p) && !v.trim()
          ? 'A maintain goal needs an assertion'
          : null,
    },
    ...SHARED,
    {
      key: 'dependsOn',
      input: { kind: 'text', placeholder: 'goal ids, comma-separated: G2, G5' },
      validate: (v, _p, { self, goalIds }) => {
        const ids = v
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
        if (ids.includes(self)) return `${self} cannot depend on itself`;
        const unknown = ids.filter((id) => !goalIds.includes(id));
        return unknown.length > 0
          ? `${unknown.join(', ')} ${unknown.length > 1 ? 'are not goals' : 'is not a goal'} in this model`
          : null;
      },
    },
    {
      key: 'variables',
      input: { kind: 'text', placeholder: 'decision variables, name:space, …' },
      validate: (v) => {
        if (!v.trim()) return null;
        const bad = v.split(',').filter((part) => {
          const pieces = part.split(':');
          return (
            pieces.length !== 2 ||
            !pieces[0]?.trim() ||
            Number.isNaN(parseInt(pieces[1] ?? '', 10))
          );
        });
        return bad.length > 0
          ? `Use name:space pairs with a number as space (got "${bad[0]?.trim()}")`
          : null;
      },
    },
  ],
  task: [
    // tasks have no maintain condition (not among the task keys): type is free text
    { key: 'type', input: { kind: 'text' } },
    {
      key: 'assertion',
      input: { kind: 'long', placeholder: 'condition, e.g. battery > 20' },
    },
    ...SHARED,
  ],
  resource: [
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
      validate: (v) =>
        v === 'bool' || v === 'int' ? null : 'The type must be bool or int',
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
      validate: (v, p) => {
        if (p.type === 'bool')
          return v === 'true' || v === 'false'
            ? null
            : 'A bool resource starts true or false';
        if (p.type !== 'int') return null;
        const value = whole(v);
        if (value === null) return 'An int resource starts at a whole number';
        const low = whole(p.lowerBound);
        const high = whole(p.upperBound);
        if (low !== null && value < low)
          return `Below the lower bound (${low})`;
        if (high !== null && value > high)
          return `Above the upper bound (${high})`;
        return null;
      },
    },
    {
      key: 'lowerBound',
      input: { kind: 'integer' },
      applies: isInt,
      required: isInt,
      notApplying: (p) =>
        `Not used while type is ${p.type ?? 'unset'} (bounds are for int resources)`,
      validate: (v, p) =>
        !isInt(p)
          ? null
          : whole(v) === null
            ? 'Use a whole number'
            : boundsError(p),
    },
    {
      key: 'upperBound',
      input: { kind: 'integer' },
      applies: isInt,
      required: isInt,
      notApplying: (p) =>
        `Not used while type is ${p.type ?? 'unset'} (bounds are for int resources)`,
      validate: (v, p) =>
        !isInt(p)
          ? null
          : whole(v) === null
            ? 'Use a whole number'
            : boundsError(p),
    },
  ],
};

export const inputOf = (
  spec: PropertySpec,
  properties: Properties,
): PropertyInput =>
  typeof spec.input === 'function' ? spec.input(properties) : spec.input;
