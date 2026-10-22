/**
 * A property value outside a dialect's enum is a Problem
 * (goal-controller#327), the way `unknown-label` is one for a link's label
 * outside `linkLabels`: istar-ts keeps a value its schema rejects as
 * written (nfrprop's `initialLabel`, typed in `frameworkProperties.ts`), so
 * `frameworkProblems` flags it instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { kaos, nfrprop, readKaos } from '@goal-controller/lib';
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

describe('the operation and object models’ Problems (#194)', () => {
  const modelOf = (text: string) =>
    parseModel(
      JSON.stringify(readKaos(text, { modelName: 'm' }).model),
      'kaos',
      'kaos',
    );
  const MODEL = `declare goal [ g ] name "G" assignedto b end
declare agent [ a ] name "A" monitors e.dirty end
declare agent [ b ] name "B" end
declare entity [ e ] attribute level : number end
declare operation [ op ] name "Op" performedby a operationalizes g end`;

  it('reads a model of these kinds, its block applied, in the kaos mode', () => {
    const model = modelOf(MODEL);
    expect(model.elements.get('op')?.kind).toBe('kaosOperations.Operation');
  });

  it('flags a member its object doesn’t declare, and the open triangle', () => {
    const problems = frameworkProblems(modelOf(MODEL), kaos).map(
      ({ code, elementId, message }) => ({ code, elementId, message }),
    );
    expect(problems).toEqual([
      {
        code: 'open-closure',
        elementId: 'a-performs-op',
        message:
          '"A" performs "Op", which operationalises "G", but is not responsible for it: assign "G" to "A"',
      },
      {
        code: 'unknown-member',
        elementId: 'a-monitors-e',
        message: 'Monitors: e has no member dirty (its members: level)',
      },
    ]);
  });

  it('opens the flood seed, its predicates declared in its block', () => {
    const flood = readFileSync(
      join(ROOT, 'examples/kaos/flood/flood.txt'),
      'utf8',
    );
    const model = parseModel(flood, 'kaosres', 'kaos');
    expect(
      [...model.elements.values()].filter(
        (e) => e.kind === 'kaosOperations.Predicate',
      ),
    ).toHaveLength(18);
  });
});
