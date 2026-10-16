import { describe, expect, it } from 'vitest';
import { whereAccepted } from '@/components/workbench/engines/shared/inspector';

/** What the inspector says of a property its engine doesn't read (STS-ml's, #167). */
describe('whereAccepted', () => {
  const none = { goal: [], task: [], resource: [], quality: [] };

  it('tells where an STS-ml goal property is declared, not that STS-ml skips goals', () => {
    const text = whereAccepted('priority', 'goal', 'sts', none, {});
    expect(text).toContain(
      "add 'priority' to properties.goal in packages/lib/src/engines/sts/definition.ts",
    );
    expect(text).not.toContain('skips goals');
  });
});
