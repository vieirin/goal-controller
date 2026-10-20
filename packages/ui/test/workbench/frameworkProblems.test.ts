/**
 * A property value outside a dialect's enum is a Problem
 * (goal-controller#327), the way `unknown-label` is one for a link's label
 * outside `linkLabels`: istar-ts keeps a value its schema rejects as
 * written (nfrprop's `initialLabel`, typed in `frameworkProperties.ts`), so
 * `frameworkProblems` flags it instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nfrprop } from '@goal-controller/lib';
import { describe, expect, it } from 'vitest';
import { parseModel } from '@/lib/workbench/dialects';
import { frameworkProblems } from '@/lib/workbench/frameworkProblems';

const ROOT = join(__dirname, '../../../..');
const NFR_WELCOME = readFileSync(
  join(ROOT, 'examples/nfr/nfr-welcome.txt'),
  'utf8',
);

const withInitialLabel = (value: string): string => {
  const json = JSON.parse(NFR_WELCOME);
  json.orphans[0].customProperties = {
    ...json.orphans[0].customProperties,
    initialLabel: value,
  };
  return JSON.stringify(json);
};

describe("a property value outside its dialect's enum (#327)", () => {
  it('flags a typo in initialLabel (not one of NFR_LABELS)', () => {
    const model = parseModel(withInitialLabel('propagated'));
    const problems = frameworkProblems(model, nfrprop);
    expect(problems).toContainEqual(
      expect.objectContaining({
        code: 'unknown-property-value',
        key: 'initialLabel',
        severity: 'error',
      }),
    );
  });

  it('is silent for a value the enum lists, or unset', () => {
    const denied = frameworkProblems(
      parseModel(withInitialLabel('denied')),
      nfrprop,
    );
    expect(denied.filter((p) => p.code === 'unknown-property-value')).toEqual(
      [],
    );
    const unset = frameworkProblems(parseModel(NFR_WELCOME), nfrprop);
    expect(unset.filter((p) => p.code === 'unknown-property-value')).toEqual(
      [],
    );
  });
});
