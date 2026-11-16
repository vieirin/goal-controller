/**
 * A link that lost an end (an element removed in the notation, goal-controller#518)
 * blocks every engine, the analysis engines too: `analyze()` reports it as an
 * error problem for an engine of each family, and an analysis does not run
 * on such a model (review of #528).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { isActorKindIn, metamodelOf } from '@istar-ts/core';
import { describe, expect, it } from 'vitest';
import type { Analysis } from '@goal-controller/lib';
import { analyze } from '@/services';
import { analyse } from '@/lib/workbench/analysis';
import { parseModel } from '@/lib/workbench/dialects';
import { serializeModel } from '@/lib/workbench/pistar';
import { withoutElements } from '@/lib/workbench/notationDocument';
import type { TransformEngine } from '@/lib/types';

const EXAMPLES = join(__dirname, '../../../../examples');

/** An engine of each family, with a seed of its own. */
const SEEDS: readonly (readonly [TransformEngine, string])[] = [
  ['edge', 'edge/simpleChoice.txt'],
  ['edgev2', 'edgeV2/simpleChoice.txt'],
  ['sleec', 'sleec/goalModel-sleec.txt'],
  ['mutrose', 'mutrose/medicine-delivery/gm/MedicineDelivery.txt'],
  ['goda', 'goda/LabResults.txt'],
  ['grl', 'grl/grl-smart-home/SmartHome2.txt'],
  ['istardt', 'istardt/istardt-order/Order.txt'],
  ['tropos4as', 'tropos4as/cleaner-agent/cleaner-agent.txt'],
  ['cgm', 'cgm/smart-home/smart-home.txt'],
  ['kaosdoc', 'kaos/mine-pump/mine-pump.txt'],
  ['kaoslts', 'kaos/mine-pump/mine-pump.txt'],
  ['kaosprop', 'kaos/mine-pump/mine-pump.txt'],
  ['kaosexpert', 'kaos/mine-pump/mine-pump.txt'],
  ['kaosres', 'kaos/mine-pump/mine-pump.txt'],
  ['kaossim', 'kaos/mine-pump/mine-pump.txt'],
  ['nfrprop', 'nfr/nfr-welcome.txt'],
];

/** A seed's text with the element a link ends at removed, its links kept. */
const orphaned = (text: string): string => {
  const model = parseModel(text);
  const link = [...model.links.values()].find((l) => {
    const target = model.elements.get(l.target);
    return (
      target !== undefined && !isActorKindIn(metamodelOf(model), target.kind)
    );
  });
  expect(link, 'a seed with a link').toBeDefined();
  const file = withoutElements(model, new Set([link!.target]));
  return serializeModel(parseModel(JSON.stringify(file)), text);
};

describe('the orphan gate, through analyze() and the analyses (#518)', () => {
  for (const [engine, path] of SEEDS) {
    const text = readFileSync(join(EXAMPLES, path), 'utf8');

    it(`${engine}: a model with an orphan link is an error problem, and one without is not`, () => {
      const lost = (modelJson: string) =>
        analyze(modelJson, engine).problems.filter((problem) =>
          problem.message.includes('a link that lost an end'),
        );
      expect(lost(text)).toEqual([]);
      const problems = lost(orphaned(text));
      expect(problems).toHaveLength(1);
      expect(problems[0]!.severity).toBe('error');
    });
  }

  it('does not run an analysis on a model with an orphan link', () => {
    const text = readFileSync(
      join(EXAMPLES, 'kaos/mine-pump/mine-pump.txt'),
      'utf8',
    );
    let ran = 0;
    const analysis = {
      label: 'Probabilities',
      run: () => {
        ran += 1;
        return { cases: [] };
      },
    } as unknown as Analysis;
    const run = analyse(
      'probabilities',
      analysis,
      text,
      parseModel(orphaned(text)),
      () => ({}) as never,
    );
    expect('error' in run && run.error).toMatch(
      /does not run on a model with a link that lost an end/,
    );
    expect(ran).toBe(0);
  });
});
