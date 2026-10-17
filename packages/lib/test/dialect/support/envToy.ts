/**
 * The toy dialect of goal-controller#135, no engine's: an artifact whose
 * `attributes` (`clean:bool, level:number, mode:wet|dry`) a goal's
 * condition reads as members (`room.clean`), and a check reading member
 * nodes. Its XMI fixture and its three-step analysis are in
 * `members.test.ts`.
 */
import {
  defineDialect,
  defineExtension,
  element,
  property,
} from '@goal-controller/dialect';
import {
  assertionMembers,
  readAssertion,
} from '@goal-controller/goal-language';
import { checks } from '../../../src/engines/checks';

export const env = defineExtension({
  name: 'env',
  label: 'Env',
  elements: [{ kind: 'env.Artifact', category: 'node' }],
  links: [],
  groupers: {},
  stereotypes: [],
  taggedValues: [],
  defaultTags: [],
});

const { assertion, pairList } = property.for<'env.goal.when'>();
const fill = '#CDFECD';
const problem = { severity: 'error', message: 'x' } as const;

export const envy = defineDialect({
  id: 'envy',
  name: 'Envy',
  extension: env,
  elements: {
    goal: element('G', { fill }),
    'env.Artifact': element('E', { fill }),
  },
  defaultFill: fill,
  properties: {
    goal: [
      assertion('when', {
        resolves: ['env.Artifact', 'variable'],
        members: { from: 'attributes' },
        help: 'when it is achieved',
        check: 'env.goal.when',
      }),
    ],
    'env.Artifact': [pairList('attributes', 'text', { help: 'name:type' })],
  },
  propertyLineOrder: ['when', 'attributes'],
  indent: '  ',
  problems: {
    notAChild: problem,
    missingFromNotation: problem,
    relationMismatch: problem,
    notInDiagram: problem,
  },
});

/** a goal's condition reads some artifact's member (read from its member nodes) */
export const envChecks = checks({
  'env.goal.when': ({ raw: { when } }) =>
    when && !assertionMembers(readAssertion(when)).length
      ? 'Reads no artifact’s member'
      : null,
});
