/**
 * Small definitions the framework's tests are written against: no engine's,
 * just enough of each feature (a notation with every operator form, a
 * declaration, conditions, a check, an assertion; a dialect with groupers,
 * stereotypes and tagged values).
 */
import { defineDialect, defineExtension, type DocumentNode } from '../../src';

export const toy = defineDialect({
  id: 'toy',
  name: 'Toy',
  elements: {
    goal: { prefix: 'G', fill: '#00FF00' },
    task: { prefix: 'T', fill: '#00FF00' },
    resource: { prefix: 'R', declares: true, fill: '#FFFF00' },
  },
  defaultFill: '#FFFFFF',
  notation: {
    operand: { kinds: ['goal', 'task'], skip: true },
    operators: { '@': 'retry', ';': 'sequence', '|': 'fallback' },
    standalone: { '*': 'any' },
    modifiers: {
      retry: {
        argument: {
          name: 'tries',
          value: { type: 'int', min: 1 },
          default: '2',
        },
        label: 'Retry',
        help: 'tries the first child again',
        appliesTo: ['fallback'],
        action: 'Try the first child {tries} times',
      },
    },
    constructs: {
      sequence: {
        label: 'Sequence',
        help: 'one after another',
        relation: 'and',
      },
      fallback: {
        label: 'Fallback',
        help: 'the first that works',
        relation: 'or',
      },
      any: { label: 'Any', help: 'whichever' },
    },
    defaultConstruct: { and: 'sequence', or: 'fallback' },
  },
  properties: {
    goal: [
      {
        key: 'priority',
        value: {
          type: 'enum',
          options: [
            { value: '', label: 'normal' },
            { value: 'high', label: 'high' },
          ],
        },
        help: 'how urgent',
      },
      {
        key: 'deadline',
        value: { type: 'int', min: 1 },
        applies: { when: { key: 'priority', equals: 'high' } },
        notApplying: 'Only read when priority is high (it is {priority})',
        help: 'seconds',
        check: 'toy.goal.deadline',
      },
      {
        key: 'hidden',
        value: { type: 'bool' },
        inspector: false,
        help: 'read, not shown',
      },
    ],
    task: [
      {
        key: 'robot',
        value: { type: 'text' },
        required: 'always',
        help: 'who',
      },
      {
        key: 'after',
        value: { type: 'refList', kind: 'goal' },
        help: 'goals first',
      },
      {
        key: 'guard',
        value: { type: 'assertion', resolves: ['resource', 'variable'] },
        help: 'when',
      },
    ],
    resource: [
      {
        key: 'type',
        value: {
          type: 'enum',
          options: [
            { value: 'int', label: 'int' },
            { value: 'bool', label: 'bool' },
          ],
        },
        help: 'its type',
      },
      {
        key: 'lowerBound',
        value: { type: 'int' },
        applies: { when: { key: 'type', equals: 'int' } },
        notApplying: 'Bounds are for int resources (type is {type})',
        help: 'lower bound',
        check: 'toy.resource.bounds',
      },
      {
        key: 'upperBound',
        value: { type: 'int' },
        applies: { when: { key: 'type', equals: 'int' } },
        help: 'upper bound',
      },
      {
        key: 'initialValue',
        value: {
          when: { key: 'type', equals: 'bool' },
          matching: { type: 'bool' },
          otherwise: { type: 'int' },
        },
        help: 'its first value',
      },
    ],
    quality: [],
  },
  propertyLineOrder: [
    'priority',
    'deadline',
    'hidden',
    'robot',
    'after',
    'guard',
  ],
  indent: '  ',
  problems: {
    notAChild: { severity: 'error', message: 'Not a child' },
    missingFromNotation: { severity: 'warning', message: 'Missing' },
    relationMismatch: {
      severity: 'error',
      message: '{construct} needs {needs}, has {relation}',
    },
    notInDiagram: { severity: 'error', message: 'Not in the diagram' },
  },
});

export const toyDialect = defineExtension({
  name: 'toyish',
  label: 'Toyish',
  elements: [
    {
      kind: 'toyish.Plan',
      behavesLike: 'istar.Task',
      pistarType: 'istar.Plan',
    },
    { kind: 'toyish.Box', category: 'node', shape: 'M 0 0 L 10 0 L 10 10 Z' },
  ],
  links: [
    {
      kind: 'toyish.Feeds',
      rules: { sources: ['toyish.Box'], targets: ['istar.Goal'] },
      line: { dash: 'dashed' },
    },
  ],
  groupers: { agents: ['istar.Agent', 'istar.Role'] },
  stereotypes: [
    { name: 'smart', appliesTo: ['agents'] },
    { name: 'urgent', appliesTo: ['istar.Task'] },
  ],
  taggedValues: [
    { name: 'kind', appliesTo: ['istar.Task'], values: ['must', 'may'] },
  ],
  defaultTags: ['Id', 'Note'],
});

/** A document node: piStar id `i-<id>`, named after its id, unless given. */
export const node = (
  n: Partial<DocumentNode> & Pick<DocumentNode, 'id' | 'kind'>,
): DocumentNode => ({
  iStarId: `i-${n.id}`,
  name: n.id,
  notation: null,
  properties: {},
  children: [],
  ...n,
});
