import { describe, expect, it } from 'vitest';
import { whereAccepted } from '@/components/workbench/engines/shared/inspector';

/** What the inspector says of a property its engine doesn't read (the dialect engines', #168). */
describe('whereAccepted', () => {
  const none = { goal: [], task: [], resource: [], quality: [] };

  it.each([
    [
      'istardt',
      'goal',
      'properties.goal',
      'packages/lib/src/engines/istardt/definition.ts',
    ],
    [
      'tropos4as',
      'goal',
      'properties.goal',
      'packages/lib/src/engines/tropos4as/definition.ts',
    ],
    [
      'cgm',
      'task',
      'properties.task',
      'packages/lib/src/engines/cgm/definition.ts',
    ],
    [
      'grl',
      'quality',
      'GRL_ELEMENT_KEYS',
      'packages/lib/src/engines/grl/mapper.ts',
    ],
  ] as const)(
    'tells where a %s %s property is declared, not that it skips the kind',
    (engine, kind, list, file) => {
      const text = whereAccepted('priority', kind, engine, none, {});
      expect(text).toContain(`add 'priority' to ${list} in ${file}`);
      expect(text).not.toContain('skips');
    },
  );

  it('still says a dialect engine skips resources', () => {
    expect(whereAccepted('priority', 'resource', 'cgm', none, {})).toContain(
      'skips resources',
    );
  });
});
