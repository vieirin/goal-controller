/**
 * Small definitions the framework's tests are written against: no engine's,
 * just enough of each feature (a notation with every operator form, a
 * declaration, conditions, a check, a language; a dialect with groupers,
 * stereotypes and tagged values).
 */
import { defineDialect, defineExtension, type DocumentNode } from '../../src';

const ID = '[0-9]+';
const NAMES = "[A-Za-z' ]";

export const toy = defineDialect({
  id: 'toy',
  name: 'Toy',
  elements: {
    goal: {
      prefix: 'G',
      idPattern: ID,
      line: '{id}: {name}',
      nameCharset: NAMES,
      fill: '#00FF00',
    },
    task: {
      prefix: 'T',
      idPattern: ID,
      line: '{id}: {name}',
      nameCharset: NAMES,
      fill: '#00FF00',
    },
    resource: {
      prefix: 'R',
      idPattern: ID,
      line: '{id}: {name}',
      nameCharset: NAMES,
      fill: '#FFFF00',
      declaration: {
        delimiters: ['{', '}'],
        parts: [
          { key: 'type', pattern: 'int|bool' },
          {
            optional: [
              { literal: ' ' },
              { key: 'low', pattern: '[0-9]+' },
              { literal: '..' },
              { key: 'high', pattern: '[0-9]+' },
            ],
          },
          {
            optional: [
              { literal: ' = ' },
              { key: 'initial', pattern: '[a-z0-9]+' },
            ],
          },
        ],
      },
    },
    quality: {
      prefix: 'Q',
      idPattern: ID,
      line: '{id}: {name}',
      nameCharset: '.',
      fill: '#00FF00',
    },
  },
  defaultFill: '#FFFFFF',
  notation: {
    delimiters: ['[', ']'],
    operand: { kinds: ['goal', 'task'], keywords: ['nothing'] },
    operators: [
      {
        symbol: '@',
        form: 'postfix',
        assoc: 'left',
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
      { symbol: ';', form: 'infix', construct: 'sequence', assoc: 'left' },
      { symbol: '|', form: 'infix', construct: 'fallback', assoc: 'left' },
      { symbol: '*', form: 'standalone', construct: 'any', assoc: 'none' },
    ],
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
        value: { type: 'refList', kind: 'goal', separator: ',' },
        help: 'goals first',
      },
      {
        key: 'guard',
        value: { type: 'expression', language: 'cond' },
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
        key: 'low',
        value: { type: 'int' },
        applies: { when: { key: 'type', equals: 'int' } },
        notApplying: 'Bounds are for int resources (type is {type})',
        help: 'lower bound',
        check: 'toy.resource.bounds',
      },
      {
        key: 'high',
        value: { type: 'int' },
        applies: { when: { key: 'type', equals: 'int' } },
        help: 'upper bound',
      },
      {
        key: 'initial',
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
  propertyLine: { separator: ' ', keyPattern: '[a-z]+' },
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
  languages: {
    cond: {
      operators: [
        { symbol: '!', form: 'prefix' },
        { symbol: '&', form: 'infix' },
      ],
      parens: ['(', ')'],
      comparators: ['<', '>'],
      literals: { int: '[0-9]+' },
      keywords: ['yes', 'no'],
      identifier: '[A-Za-z][A-Za-z0-9]*',
      resolves: ['resource', 'variable'],
    },
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
  annotations: {
    stereotype: {
      delimiters: ['<<', '>>'],
      parts: [{ key: 'stereotype', pattern: '[^<>]*[^<>\\s]' }],
    },
    taggedValue: {
      delimiters: ['{', '}'],
      parts: [
        { key: 'tag', pattern: '[^{}=]*[^{}=\\s]' },
        {
          optional: [
            { literal: ' = ' },
            { key: 'tagValue', pattern: '[^{}]*[^{}\\s]' },
          ],
        },
      ],
    },
  },
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
